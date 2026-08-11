import { describe, it, expect } from "vitest";
import {
  validateMonitorInput,
  isUp,
  isDue,
  transition,
  uptimePercent,
  type MonitorInput,
  type ProbeResult,
} from "./domain/monitor";

const base: MonitorInput = {
  name: "Sitio",
  url: "https://example.com",
  method: "GET",
  expectedStatus: 0,
  intervalSeconds: 300,
  timeoutMs: 10000,
  active: true,
  notifyOnFailure: true,
};

describe("validateMonitorInput", () => {
  it("accepts a valid monitor and strips a trailing slash", () => {
    const r = validateMonitorInput({ ...base, url: "https://example.com/" });
    expect(r.ok && r.value.url).toBe("https://example.com");
  });
  it("rejects a non-http URL", () => {
    expect(validateMonitorInput({ ...base, url: "ftp://x" }).ok).toBe(false);
  });
  it("rejects an empty name", () => {
    expect(validateMonitorInput({ ...base, name: "  " }).ok).toBe(false);
  });
  it("enforces the minimum interval", () => {
    expect(validateMonitorInput({ ...base, intervalSeconds: 10 }).ok).toBe(false);
  });
  it("bounds the timeout", () => {
    expect(validateMonitorInput({ ...base, timeoutMs: 100 }).ok).toBe(false);
    expect(validateMonitorInput({ ...base, timeoutMs: 120000 }).ok).toBe(false);
  });
});

function probe(over: Partial<ProbeResult> = {}): ProbeResult {
  return { ok: true, statusCode: 200, responseMs: 50, error: null, ...over };
}

describe("isUp", () => {
  it("accepts any 2xx/3xx when expectedStatus is 0", () => {
    expect(isUp(0, probe({ statusCode: 204 }))).toBe(true);
    expect(isUp(0, probe({ statusCode: 302 }))).toBe(true);
    expect(isUp(0, probe({ statusCode: 500 }))).toBe(false);
  });
  it("requires an exact match when expectedStatus is set", () => {
    expect(isUp(200, probe({ statusCode: 200 }))).toBe(true);
    expect(isUp(200, probe({ statusCode: 301 }))).toBe(false);
  });
  it("is down on a failed request", () => {
    expect(isUp(0, probe({ ok: false, statusCode: null }))).toBe(false);
  });
});

describe("isDue", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("is due when never checked", () => {
    expect(isDue({ active: true, intervalSeconds: 300, lastCheckedAt: null }, now)).toBe(true);
  });
  it("is not due before the interval elapses", () => {
    const last = new Date(now.getTime() - 100_000);
    expect(isDue({ active: true, intervalSeconds: 300, lastCheckedAt: last }, now)).toBe(false);
  });
  it("is due after the interval elapses", () => {
    const last = new Date(now.getTime() - 400_000);
    expect(isDue({ active: true, intervalSeconds: 300, lastCheckedAt: last }, now)).toBe(true);
  });
  it("is never due when inactive", () => {
    expect(isDue({ active: false, intervalSeconds: 300, lastCheckedAt: null }, now)).toBe(false);
  });
});

describe("transition", () => {
  it("alerts on up→down", () => {
    expect(transition("up", false)).toEqual({ status: "down", alert: "down" });
  });
  it("alerts recovery on down→up", () => {
    expect(transition("down", true)).toEqual({ status: "up", alert: "recovered" });
  });
  it("does not alert when unchanged", () => {
    expect(transition("up", true)).toEqual({ status: "up", alert: null });
    expect(transition("down", false)).toEqual({ status: "down", alert: null });
  });
  it("from unknown: alerts only if starting down", () => {
    expect(transition("unknown", true)).toEqual({ status: "up", alert: null });
    expect(transition("unknown", false)).toEqual({ status: "down", alert: "down" });
  });
});

describe("uptimePercent", () => {
  it("computes a rounded percentage", () => {
    expect(uptimePercent([{ ok: true }, { ok: true }, { ok: false }, { ok: true }])).toBe(75);
  });
  it("is 0 for no checks", () => {
    expect(uptimePercent([])).toBe(0);
  });
});
