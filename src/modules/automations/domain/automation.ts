import { type Result, ok, err } from "@/shared/kernel/result";

/**
 * Triggers are fired from other modules' services. Each carries a fixed set
 * of `{{variable}}` names available to action templates.
 */
export type TriggerType =
  | "uptime_down"
  | "uptime_recovered"
  | "budget_exceeded"
  | "user_registered";

export interface TriggerMeta {
  label: string;
  description: string;
  /** Variable names available in `{{...}}` templates for this trigger. */
  variables: string[];
}

export const TRIGGERS: Record<TriggerType, TriggerMeta> = {
  uptime_down: {
    label: "Monitor caído",
    description:
      "Un monitor de Uptime pasó a estado caído. Ya recibes un aviso de Telegram automático para esto; usa esta automatización para acciones extra.",
    variables: ["monitor", "url", "motivo"],
  },
  uptime_recovered: {
    label: "Monitor recuperado",
    description: "Un monitor de Uptime volvió a estar en línea.",
    variables: ["monitor", "url"],
  },
  budget_exceeded: {
    label: "Presupuesto superado",
    description: "El gasto de una categoría este mes superó su presupuesto.",
    variables: ["categoria", "limite", "gastado"],
  },
  user_registered: {
    label: "Nuevo registro pendiente",
    description:
      "Alguien se registró y quedó pendiente de aprobación. Ya recibes un aviso de Telegram automático para esto.",
    variables: ["nombre", "email"],
  },
};

export const TRIGGER_TYPES = Object.keys(TRIGGERS) as TriggerType[];

export type ActionType = "telegram" | "calendar_event";

export interface TelegramActionConfig {
  message: string;
}

export interface CalendarEventActionConfig {
  title: string;
  description: string;
  /** Days from today to schedule the event; 0 = today. */
  daysFromNow: number;
}

export type ActionConfig =
  | { type: "telegram"; config: TelegramActionConfig }
  | { type: "calendar_event"; config: CalendarEventActionConfig };

export const ACTION_TYPES: ActionType[] = ["telegram", "calendar_event"];

export const ACTION_LABELS: Record<ActionType, string> = {
  telegram: "Enviar mensaje de Telegram",
  calendar_event: "Crear evento en el calendario",
};

export interface AutomationRule {
  id: string;
  name: string;
  trigger: TriggerType;
  active: boolean;
  actions: ActionConfig[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationRuleInput {
  name: string;
  trigger: TriggerType;
  active: boolean;
  actions: ActionConfig[];
}

export interface AutomationRuleDTO {
  id: string;
  name: string;
  trigger: TriggerType;
  active: boolean;
  actions: ActionConfig[];
  createdAt: string;
}

export function toRuleDTO(r: AutomationRule): AutomationRuleDTO {
  return {
    id: r.id,
    name: r.name,
    trigger: r.trigger,
    active: r.active,
    actions: r.actions,
    createdAt: r.createdAt.toISOString(),
  };
}

export interface AutomationRunRecord {
  ok: boolean;
  error: string | null;
  ranAt: Date;
}

export interface AutomationRunDTO {
  ok: boolean;
  error: string | null;
  ranAt: string;
}

export function toRunDTO(r: AutomationRunRecord): AutomationRunDTO {
  return { ok: r.ok, error: r.error, ranAt: r.ranAt.toISOString() };
}

function validateAction(action: ActionConfig, index: number): Result<ActionConfig> {
  if (action.type === "telegram") {
    if (!action.config.message.trim()) {
      return err(`Acción ${index + 1}: el mensaje de Telegram no puede estar vacío.`);
    }
    return ok(action);
  }
  if (action.type === "calendar_event") {
    if (!action.config.title.trim()) {
      return err(`Acción ${index + 1}: el evento necesita un título.`);
    }
    if (!Number.isInteger(action.config.daysFromNow) || action.config.daysFromNow < 0) {
      return err(`Acción ${index + 1}: los días desde hoy deben ser 0 o más.`);
    }
    return ok(action);
  }
  return err(`Acción ${index + 1}: tipo de acción desconocido.`);
}

export function validateRuleInput(input: AutomationRuleInput): Result<AutomationRuleInput> {
  const name = input.name.trim();
  if (!name) return err("El nombre no puede estar vacío.");
  if (!TRIGGER_TYPES.includes(input.trigger)) {
    return err(`Disparador no soportado: ${input.trigger}`);
  }
  if (input.actions.length === 0) {
    return err("Añade al menos una acción.");
  }
  for (let i = 0; i < input.actions.length; i++) {
    const valid = validateAction(input.actions[i], i);
    if (!valid.ok) return valid;
  }
  return ok({ ...input, name });
}
