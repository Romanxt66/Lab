import "server-only";
import * as cheerio from "cheerio";
import { type Result, ok, err } from "@/shared/kernel/result";
import type { HtmlExtractorPort } from "@/modules/scraper/application/ports";

const MAX_ITEMS = 1000;

/** HtmlExtractorPort backed by Cheerio (static HTML parsing). */
export class CheerioExtractor implements HtmlExtractorPort {
  extract(
    html: string,
    selector: string,
    attribute?: string,
  ): Result<string[]> {
    let $: cheerio.CheerioAPI;
    try {
      $ = cheerio.load(html);
    } catch {
      return err("No se pudo parsear el HTML.");
    }

    let nodes;
    try {
      nodes = $(selector);
    } catch {
      return err("Selector CSS inválido.");
    }

    const items: string[] = [];
    nodes.slice(0, MAX_ITEMS).each((_, el) => {
      const value = attribute
        ? ($(el).attr(attribute) ?? "")
        : $(el).text().trim().replace(/\s+/g, " ");
      if (value) items.push(value);
    });
    return ok(items);
  }
}
