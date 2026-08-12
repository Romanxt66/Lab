import { type Result, ok, err } from "@/shared/kernel/result";
import {
  validateRuleInput,
  toRuleDTO,
  toRunDTO,
  type ActionConfig,
  type AutomationRule,
  type AutomationRuleDTO,
  type AutomationRuleInput,
  type AutomationRunDTO,
  type TriggerType,
} from "@/modules/automations/domain/automation";
import { renderTemplate } from "@/modules/email/domain/template";
import type { SendNotification } from "@/modules/notifications/application/send-notification";
import type { CalendarService } from "@/modules/calendar/application/calendar-service";
import type { AutomationRuleRepoPort } from "./ports";

/**
 * AutomationService: CRUD over rules, plus `trigger()` — the entry point
 * other modules call to fire an event. `trigger()` never throws: a failing
 * or misconfigured rule is logged (visible in the rule's run history) rather
 * than breaking the caller's flow (a cron tick, a transaction save, a login).
 */
export class AutomationService {
  constructor(
    private readonly rules: AutomationRuleRepoPort,
    private readonly notifier: SendNotification,
    private readonly calendar: CalendarService,
  ) {}

  list(): Promise<AutomationRuleDTO[]> {
    return this.rules.list().then((rows) => rows.map(toRuleDTO));
  }

  listRuns(ruleId: string, limit = 20): Promise<AutomationRunDTO[]> {
    return this.rules.listRuns(ruleId, limit).then((rows) => rows.map(toRunDTO));
  }

  async save(
    input: AutomationRuleInput & { id?: string },
  ): Promise<Result<AutomationRuleDTO>> {
    const valid = validateRuleInput(input);
    if (!valid.ok) return valid;
    const saved = input.id
      ? await this.rules.update(input.id, valid.value)
      : await this.rules.create(valid.value);
    return ok(toRuleDTO(saved));
  }

  async remove(id: string): Promise<void> {
    await this.rules.remove(id);
  }

  /** Fire a trigger: run every active rule registered for it. Never throws. */
  async trigger(type: TriggerType, vars: Record<string, string>): Promise<void> {
    let rules: AutomationRule[];
    try {
      rules = await this.rules.listActiveForTrigger(type);
    } catch {
      return; // repo unreachable — nothing to run, nothing to log.
    }

    for (const rule of rules) {
      let succeeded = true;
      let error: string | null = null;
      try {
        for (const action of rule.actions) {
          const res = await this.runAction(action, vars);
          if (!res.ok) {
            succeeded = false;
            error = res.error;
            break;
          }
        }
      } catch (e) {
        succeeded = false;
        error = e instanceof Error ? e.message : String(e);
      }
      try {
        await this.rules.logRun(rule.id, succeeded, error);
      } catch {
        /* logging is best-effort */
      }
    }
  }

  private async runAction(
    action: ActionConfig,
    vars: Record<string, string>,
  ): Promise<Result<void>> {
    if (action.type === "telegram") {
      return this.notifier.execute(renderTemplate(action.config.message, vars));
    }

    const start = new Date();
    start.setDate(start.getDate() + action.config.daysFromNow);
    const res = await this.calendar.create({
      title: renderTemplate(action.config.title, vars),
      description: action.config.description
        ? renderTemplate(action.config.description, vars)
        : null,
      start,
      end: null,
      allDay: true,
      location: null,
      color: null,
      remindMinutesBefore: null,
    });
    return res.ok ? ok(undefined) : err(res.error);
  }
}
