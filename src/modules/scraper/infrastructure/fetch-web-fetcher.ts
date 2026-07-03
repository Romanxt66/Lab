import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import type { WebFetcherPort, FetchedPage } from "@/modules/scraper/application/ports";

const TIMEOUT_MS = 15_000;
const UA =
  "Mozilla/5.0 (compatible; LabScraper/1.0; +https://localhost) AppleWebKit/537.36";

/** WebFetcherPort over the global fetch API, with a timeout and UA header. */
export class FetchWebFetcher implements WebFetcherPort {
  async fetch(url: string): Promise<Result<FetchedPage>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "*/*" },
        signal: controller.signal,
        redirect: "follow",
      });
      const body = await res.text();
      return ok({
        status: res.status,
        contentType: res.headers.get("content-type") ?? "",
        body,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return err("La petición superó el tiempo límite (15s).");
      }
      return err(e instanceof Error ? e.message : "Error de red.");
    } finally {
      clearTimeout(timer);
    }
  }
}
