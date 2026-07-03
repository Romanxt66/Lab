"use server";

import type { Result } from "@/shared/kernel/result";
import { getRunScrape } from "@/shared/di/container";
import type { RunScrapeResult } from "@/modules/scraper/application/run-scrape";

/** Entry adapter for the scraper module. */
export async function scrapeAction(input: {
  url: string;
  selector?: string;
  attribute?: string;
}): Promise<Result<RunScrapeResult>> {
  return getRunScrape().execute(input);
}
