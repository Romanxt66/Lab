import { describe, it, expect } from "vitest";
import { validateRuleInput, TRIGGER_TYPES, TRIGGERS, type AutomationRuleInput } from "./domain/automation";

function baseInput(overrides: Partial<AutomationRuleInput> = {}): AutomationRuleInput {
  return {
    name: "Avisar caída",
    trigger: "uptime_down",
    active: true,
    actions: [{ type: "telegram", config: { message: "{{monitor}} caído" } }],
    ...overrides,
  };
}

describe("validateRuleInput", () => {
  it("accepts a valid rule", () => {
    const res = validateRuleInput(baseInput());
    expect(res.ok).toBe(true);
  });

  it("rejects an empty name", () => {
    const res = validateRuleInput(baseInput({ name: "  " }));
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown trigger", () => {
    // @ts-expect-error deliberately invalid for the test
    const res = validateRuleInput(baseInput({ trigger: "not_a_trigger" }));
    expect(res.ok).toBe(false);
  });

  it("rejects a rule with no actions", () => {
    const res = validateRuleInput(baseInput({ actions: [] }));
    expect(res.ok).toBe(false);
  });

  it("rejects an empty Telegram message", () => {
    const res = validateRuleInput(
      baseInput({ actions: [{ type: "telegram", config: { message: "  " } }] }),
    );
    expect(res.ok).toBe(false);
  });

  it("rejects a calendar_event action with no title", () => {
    const res = validateRuleInput(
      baseInput({
        actions: [
          { type: "calendar_event", config: { title: "", description: "", daysFromNow: 0 } },
        ],
      }),
    );
    expect(res.ok).toBe(false);
  });

  it("rejects negative daysFromNow", () => {
    const res = validateRuleInput(
      baseInput({
        actions: [
          {
            type: "calendar_event",
            config: { title: "Revisar", description: "", daysFromNow: -1 },
          },
        ],
      }),
    );
    expect(res.ok).toBe(false);
  });

  it("trims the name", () => {
    const res = validateRuleInput(baseInput({ name: "  Avisar  " }));
    expect(res.ok && res.value.name).toBe("Avisar");
  });
});

describe("TRIGGERS registry", () => {
  it("has metadata for every trigger type", () => {
    for (const t of TRIGGER_TYPES) {
      expect(TRIGGERS[t].label).toBeTruthy();
      expect(TRIGGERS[t].variables.length).toBeGreaterThan(0);
    }
  });
});
