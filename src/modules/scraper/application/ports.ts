import type { Result } from "@/shared/kernel/result";

/** Ports for the scraper module. Adapters live in `infrastructure/`. */

export interface FetchedPage {
  status: number;
  contentType: string;
  body: string;
}

export interface WebFetcherPort {
  fetch(url: string): Promise<Result<FetchedPage>>;
}

export interface HtmlExtractorPort {
  /**
   * Return the text (or a given attribute) of every element matching `selector`.
   */
  extract(
    html: string,
    selector: string,
    attribute?: string,
  ): Result<string[]>;
}
