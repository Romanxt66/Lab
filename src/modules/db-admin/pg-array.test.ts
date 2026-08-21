import { describe, it, expect } from "vitest";
import { toStringArray } from "./domain/pg-array";

describe("toStringArray", () => {
  it("passes a real array through", () => {
    expect(toStringArray(["id", "author_id"])).toEqual(["id", "author_id"]);
  });

  it("parses the raw literal node-postgres returns for name[]", () => {
    // This is the exact shape that made the FK-backed tabs hang: a string
    // where the code expected an array.
    expect(toStringArray("{id,author_id}")).toEqual(["id", "author_id"]);
  });

  it("handles a single-element literal", () => {
    expect(toStringArray("{id}")).toEqual(["id"]);
  });

  it("returns an empty array for an empty literal", () => {
    expect(toStringArray("{}")).toEqual([]);
  });

  it("keeps commas inside quoted elements together", () => {
    expect(toStringArray('{"a,b",c}')).toEqual(["a,b", "c"]);
  });

  it("unescapes a quoted element containing a quote", () => {
    expect(toStringArray('{"we\\"ird",x}')).toEqual(['we"ird', "x"]);
  });

  it("never returns a non-array for null/undefined/garbage", () => {
    expect(toStringArray(null)).toEqual([]);
    expect(toStringArray(undefined)).toEqual([]);
    expect(toStringArray(42)).toEqual([]);
    expect(toStringArray("not an array literal")).toEqual([]);
  });

  it("coerces non-string array members", () => {
    expect(toStringArray([1, 2])).toEqual(["1", "2"]);
  });
});
