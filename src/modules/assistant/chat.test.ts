import { describe, it, expect } from "vitest";
import { trimHistory, type ChatMessage } from "./domain/chat";

describe("trimHistory", () => {
  it("keeps history under the message cap unchanged", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "hola" },
      { role: "assistant", content: "hola!" },
    ];
    expect(trimHistory(history)).toEqual(history);
  });

  it("drops the oldest messages beyond the cap", () => {
    const history: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg ${i}`,
    }));
    const trimmed = trimHistory(history);
    expect(trimmed.length).toBe(20);
    expect(trimmed[0].content).toBe("msg 10");
    expect(trimmed.at(-1)?.content).toBe("msg 29");
  });

  it("truncates an absurdly long message", () => {
    const history: ChatMessage[] = [{ role: "user", content: "x".repeat(10_000) }];
    expect(trimHistory(history)[0].content.length).toBe(4000);
  });
});
