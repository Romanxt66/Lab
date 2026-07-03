import { type Result, ok } from "@/shared/kernel/result";
import { validateUrl } from "@/modules/scraper/domain/url";
import type { WebFetcherPort, HtmlExtractorPort } from "./ports";

export interface RunScrapeInput {
  url: string;
  /** Optional CSS selector. When omitted, the raw body is returned. */
  selector?: string;
  /** Optional attribute to read instead of text (e.g. "href"). */
  attribute?: string;
}

export interface RunScrapeResult {
  status: number;
  contentType: string;
  /** Present when a selector was given. */
  items?: string[];
  /** Present when no selector was given (truncated). */
  raw?: string;
}

const RAW_LIMIT = 20_000;

/**
 * RunScrape use-case: fetch a page, then either extract via CSS selector or
 * return the raw body. Depends only on ports, so it's testable with fakes.
 */
export class RunScrape {
  constructor(
    private readonly fetcher: WebFetcherPort,
    private readonly extractor: HtmlExtractorPort,
  ) {}

  async execute(input: RunScrapeInput): Promise<Result<RunScrapeResult>> {
    const url = validateUrl(input.url);
    if (!url.ok) return url;

    const page = await this.fetcher.fetch(url.value);
    if (!page.ok) return page;

    if (input.selector?.trim()) {
      const items = this.extractor.extract(
        page.value.body,
        input.selector.trim(),
        input.attribute?.trim() || undefined,
      );
      if (!items.ok) return items;
      return ok({
        status: page.value.status,
        contentType: page.value.contentType,
        items: items.value,
      });
    }

    return ok({
      status: page.value.status,
      contentType: page.value.contentType,
      raw: page.value.body.slice(0, RAW_LIMIT),
    });
  }
}
