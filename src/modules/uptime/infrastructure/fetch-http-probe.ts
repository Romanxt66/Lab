import "server-only";
import type { HttpProbePort } from "@/modules/uptime/application/ports";
import type { HttpMethod, ProbeResult } from "@/modules/uptime/domain/monitor";

/** HttpProbePort backed by fetch, with a per-monitor timeout. */
export class FetchHttpProbe implements HttpProbePort {
  async probe(
    url: string,
    method: HttpMethod,
    timeoutMs: number,
  ): Promise<ProbeResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store",
        headers: { "User-Agent": "Lab-Uptime/1.0" },
      });
      // Drain the body so the connection is freed (GET only).
      if (method === "GET") {
        try {
          await res.arrayBuffer();
        } catch {
          /* ignore body read errors — we already have the status */
        }
      }
      return {
        ok: true,
        statusCode: res.status,
        responseMs: Date.now() - start,
        error: null,
      };
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      return {
        ok: false,
        statusCode: null,
        responseMs: Date.now() - start,
        error: aborted
          ? `Timeout (${timeoutMs} ms)`
          : e instanceof Error
            ? e.message
            : "Error de red",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
