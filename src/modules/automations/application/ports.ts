import { type Result } from "@/shared/kernel/result";
import type {
  ActionConfig,
  AutomationRule,
  AutomationRuleInput,
  AutomationRunRecord,
  TriggerType,
} from "@/modules/automations/domain/automation";

/** Fires an outbound HTTP call to an external automation tool (e.g. n8n). */
export interface WebhookPort {
  post(url: string, body: Record<string, unknown>): Promise<Result<void>>;
}

export interface AutomationRuleRepoPort {
  list(): Promise<AutomationRule[]>;
  listActiveForTrigger(trigger: TriggerType): Promise<AutomationRule[]>;
  get(id: string): Promise<AutomationRule | null>;
  create(input: AutomationRuleInput): Promise<AutomationRule>;
  update(id: string, input: AutomationRuleInput): Promise<AutomationRule>;
  remove(id: string): Promise<void>;
  logRun(ruleId: string, ok: boolean, error: string | null): Promise<void>;
  listRuns(ruleId: string, limit: number): Promise<AutomationRunRecord[]>;
}

/** Re-exported so infra/UI don't need to reach into the domain module directly. */
export type { ActionConfig };
