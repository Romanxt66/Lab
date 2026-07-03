import { describe, it, expect } from "vitest";
import { formatJson, minifyJson } from "./json";
import { encodeBase64, decodeBase64 } from "./base64";
import { decodeJwt } from "./jwt";
import { runRegex } from "./regex";
import { parseTime } from "./timestamp";
import { generateUuids, hashText } from "./uuid-hash";

describe("json", () => {
  it("formats valid JSON with indentation", () => {
    const r = formatJson('{"a":1}', 2);
    expect(r.ok && r.value).toBe('{\n  "a": 1\n}');
  });
  it("reports invalid JSON", () => {
    const r = formatJson("{nope}");
    expect(r.ok).toBe(false);
  });
  it("minifies", () => {
    const r = minifyJson('{ "a":  1 }');
    expect(r.ok && r.value).toBe('{"a":1}');
  });
});

describe("base64", () => {
  it("round-trips UTF-8", () => {
    const enc = encodeBase64("héllo 🌍");
    expect(enc.ok).toBe(true);
    const dec = enc.ok ? decodeBase64(enc.value) : null;
    expect(dec?.ok && dec.value).toBe("héllo 🌍");
  });
  it("rejects invalid base64", () => {
    // Contains characters outside the base64 alphabet.
    expect(decodeBase64("@@@not base64@@@").ok).toBe(false);
  });
});

describe("jwt", () => {
  // header {alg:HS256,typ:JWT} . payload {sub:123,name:John,exp:0} . sig
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJuYW1lIjoiSm9obiIsImV4cCI6MH0.sig";
  it("decodes header and payload without verifying", () => {
    const r = decodeJwt(token);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.header.alg).toBe("HS256");
      expect(r.value.payload.name).toBe("John");
      expect(r.value.isExpired).toBe(true); // exp:0 → expired
    }
  });
  it("rejects malformed tokens", () => {
    expect(decodeJwt("only.two").ok).toBe(false);
  });
});

describe("regex", () => {
  it("finds all matches with capture groups", () => {
    const r = runRegex("(\\d)(\\d)", "g", "12 34");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.count).toBe(2);
      expect(r.value.matches[0].groups).toEqual(["1", "2"]);
    }
  });
  it("handles empty-match patterns without infinite loop", () => {
    const r = runRegex("a*", "g", "aaa");
    expect(r.ok).toBe(true);
  });
  it("reports invalid patterns", () => {
    expect(runRegex("(", "g", "x").ok).toBe(false);
  });
});

describe("timestamp", () => {
  it("parses unix seconds", () => {
    const r = parseTime("0");
    expect(r.ok && r.value.iso).toBe("1970-01-01T00:00:00.000Z");
  });
  it("parses unix millis (13+ digits)", () => {
    const r = parseTime("1700000000000");
    expect(r.ok && r.value.unixMillis).toBe(1700000000000);
  });
  it("rejects garbage", () => {
    expect(parseTime("not a date").ok).toBe(false);
  });
});

describe("uuid & hash", () => {
  it("generates the requested count of unique UUIDs", () => {
    const ids = generateUuids(10);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });
  it("computes a known SHA-256 digest", async () => {
    const r = await hashText("SHA-256", "abc");
    expect(r.ok && r.value).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
