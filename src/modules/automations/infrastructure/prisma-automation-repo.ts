import "server-only";
import { db } from "@/shared/db";
import type { AutomationRuleRepoPort } from "@/modules/automations/application/ports";
import type {
  ActionConfig,
  AutomationRule,
  AutomationRuleInput,
  AutomationRunRecord,
  TriggerType,
} from "@/modules/automations/domain/automation";

type Row = {
  id: string;
  name: string;
  trigger: string;
  active: boolean;
  actions: unknown;
  createdAt: Date;
  updatedAt: Date;
};

/** Prisma's `Json` input type is intentionally stricter than our tagged
 * union; a round-trip through JSON keeps it structurally plain. */
function toJson(actions: ActionConfig[]): object {
  return JSON.parse(JSON.stringify(actions)) as object;
}

function toDomain(row: Row): AutomationRule {
  return {
    id: row.id,
    name: row.name,
    trigger: row.trigger as TriggerType,
    active: row.active,
    actions: row.actions as ActionConfig[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** AutomationRuleRepoPort backed by Prisma (tables `lab_automation_rule` / `_run`). */
export class PrismaAutomationRepo implements AutomationRuleRepoPort {
  async list(): Promise<AutomationRule[]> {
    const rows = await db.automationRule.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toDomain);
  }

  async listActiveForTrigger(trigger: TriggerType): Promise<AutomationRule[]> {
    const rows = await db.automationRule.findMany({ where: { trigger, active: true } });
    return rows.map(toDomain);
  }

  async get(id: string): Promise<AutomationRule | null> {
    const row = await db.automationRule.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(input: AutomationRuleInput): Promise<AutomationRule> {
    const row = await db.automationRule.create({
      data: {
        name: input.name,
        trigger: input.trigger,
        active: input.active,
        actions: toJson(input.actions),
      },
    });
    return toDomain(row);
  }

  async update(id: string, input: AutomationRuleInput): Promise<AutomationRule> {
    const row = await db.automationRule.update({
      where: { id },
      data: {
        name: input.name,
        trigger: input.trigger,
        active: input.active,
        actions: toJson(input.actions),
      },
    });
    return toDomain(row);
  }

  async remove(id: string): Promise<void> {
    await db.automationRule.delete({ where: { id } });
  }

  async logRun(ruleId: string, ok: boolean, error: string | null): Promise<void> {
    await db.automationRun.create({ data: { ruleId, ok, error } });
  }

  async listRuns(ruleId: string, limit: number): Promise<AutomationRunRecord[]> {
    const rows = await db.automationRun.findMany({
      where: { ruleId },
      orderBy: { ranAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({ ok: r.ok, error: r.error, ranAt: r.ranAt }));
  }
}
