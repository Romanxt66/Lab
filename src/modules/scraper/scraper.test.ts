import { describe, it, expect } from "vitest";
import { ok, err, type Result } from "@/shared/kernel/result";
import { validateUrl } from "./domain/url";
import { RunScrape } from "./application/run-scrape";
import type {
  WebFetcherPort,
  HtmlExtractorPort,
  FetchedPage,
} from "./application/ports";

const HTML = `<ul><li class="x">A</li><li class="x">B</li></ul>`;

class FakeFetcher implements WebFetcherPort {
  constructor(private page: FetchedPage = { status: 200, contentType: "text/html", body: HTML }) {}
  async fetch(): Promise<Result<FetchedPage>> {
    return ok(this.page);
  }
}

// A tiny extractor stand-in (avoids pulling cheerio/server-only into tests).
class FakeExtractor implements HtmlExtractorPort {
  extract(html: string, selector: string): Result<string[]> {
    if (selector === "!!!") return err("Selector CSS inválido.");
    const matches = [...html.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1]);
    return ok(matches);
  }
}

describe("validateUrl", () => {
  it("accepts http(s)", () => {
    expect(validateUrl("https://a.com").ok).toBe(true);
  });
  it("rejects other schemes and garbage", () => {
    expect(validateUrl("ftp://a.com").ok).toBe(false);
    expect(validateUrl("not a url").ok).toBe(false);
  });
});

describe("RunScrape", () => {
  it("extracts with a selector", async () => {
    const res = await new RunScrape(new FakeFetcher(), new FakeExtractor()).execute({
      url: "https://a.com",
      selector: "li.x",
    });
    expect(res.ok && res.value.items).toEqual(["A", "B"]);
  });

  it("returns raw body without a selector", async () => {
    const res = await new RunScrape(new FakeFetcher(), new FakeExtractor()).execute({
      url: "https://a.com",
    });
    expect(res.ok && res.value.raw).toBe(HTML);
  });

  it("rejects an invalid URL before fetching", async () => {
    const res = await new RunScrape(new FakeFetcher(), new FakeExtractor()).execute({
      url: "javascript:alert(1)",
    });
    expect(res.ok).toBe(false);
  });
});
