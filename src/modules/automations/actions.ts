"use server";

import { type Result } from "@/shared/kernel/result";
import { getAutomationService } from "@/shared/di/container";
import type {
  ActionConfig,
  AutomationRuleDTO,
  AutomationRunDTO,
  TriggerType,
} from "@/modules/automations/domain/automation";

export async function listRulesAction(): Promise<AutomationRuleDTO[]> {
  return getAutomationService().list();
}

export async function listRuleRunsAction(ruleId: string): Promise<AutomationRunDTO[]> {
  return getAutomationService().listRuns(ruleId);
}

export async function saveRuleAction(input: {
  id?: string;
  name: string;
  trigger: TriggerType;
  active: boolean;
  actions: ActionConfig[];
}): Promise<Result<AutomationRuleDTO>> {
  return getAutomationService().save(input);
}

export async function deleteRuleAction(id: string): Promise<void> {
  await getAutomationService().remove(id);
}
