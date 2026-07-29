/**
 * Client-side tool-usage tracking (per-device, localStorage). Records each tool
 * visit so the home dashboard can show "used today", "most used" and recent
 * activity — no server round-trips, no data model.
 */

const KEY = "lab:usage";
const MAX = 300;
export const USAGE_EVENT = "lab:usagechange";

export interface Visit {
  slug: string;
  at: number; // epoch ms
}

export function readVisits(): Visit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Visit[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Record a visit. De-dupes rapid remounts of the same tool (within 3s). */
export function recordToolVisit(slug: string): void {
  if (typeof window === "undefined" || !slug) return;
  try {
    const list = readVisits();
    const last = list[0];
    if (last && last.slug === slug && Date.now() - last.at < 3000) return;
    list.unshift({ slug, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(USAGE_EVENT));
  } catch {
    /* ignore quota / serialization errors */
  }
}

// --- Reactive snapshot (for useSyncExternalStore) --------------------------
// getSnapshot must return a stable reference while unchanged, so cache the
// parsed array keyed by the raw string.
const EMPTY: Visit[] = [];
let cacheRaw: string | null = null;
let cacheVal: Visit[] = EMPTY;

export function getVisitsSnapshot(): Visit[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY) ?? "[]";
    if (raw !== cacheRaw) {
      cacheRaw = raw;
      const parsed = JSON.parse(raw) as Visit[];
      cacheVal = Array.isArray(parsed) ? parsed : EMPTY;
    }
    return cacheVal;
  } catch {
    return EMPTY;
  }
}

export function getServerVisitsSnapshot(): Visit[] {
  return EMPTY;
}

export function subscribeUsage(cb: () => void): () => void {
  window.addEventListener(USAGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(USAGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export interface UsageSummary {
  todayCount: number;
  totalCount: number;
  /** Slugs ordered by visit count, most-used first. */
  top: { slug: string; count: number }[];
  /** Most recent visits, de-duplicated by slug (latest first). */
  recent: Visit[];
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function summarize(visits: Visit[]): UsageSummary {
  const since = startOfToday();
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  const recent: Visit[] = [];
  let todayCount = 0;

  for (const v of visits) {
    counts.set(v.slug, (counts.get(v.slug) ?? 0) + 1);
    if (v.at >= since) todayCount++;
    if (!seen.has(v.slug)) {
      seen.add(v.slug);
      recent.push(v);
    }
  }

  const top = [...counts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count);

  return { todayCount, totalCount: visits.length, top, recent };
}
