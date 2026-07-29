/**
 * Client-side UI personalization (per-device, persisted in localStorage):
 * accent gradient, density, font size and a compact sidebar. Applied to the
 * <html> element via data-attributes + CSS variables (see globals.css), and
 * pre-applied before first paint by `personalizationScript` to avoid a flash.
 */

export interface Accent {
  id: string;
  name: string;
  /** Gradient stops. */
  c1: string;
  c2: string;
}

/** Selectable accent gradients (from the personalized-dashboard design). */
export const ACCENTS: Accent[] = [
  { id: "violeta", name: "Violeta", c1: "#a855f7", c2: "#ec4899" },
  { id: "turquesa", name: "Turquesa", c1: "#06b6d4", c2: "#3b82f6" },
  { id: "esmeralda", name: "Esmeralda", c1: "#10b981", c2: "#06b6d4" },
  { id: "ambar", name: "Ámbar", c1: "#f59e0b", c2: "#ef4444" },
];

export type Density = "comfortable" | "compact";
export type FontSize = "sm" | "md" | "lg";

export interface Personalization {
  accent: string; // Accent id
  density: Density;
  fontSize: FontSize;
  compactSidebar: boolean;
}

export const DEFAULT_PERSONALIZATION: Personalization = {
  accent: "violeta",
  density: "comfortable",
  fontSize: "md",
  compactSidebar: false,
};

export const STORAGE_KEYS = {
  accent: "lab:accent",
  density: "lab:density",
  fontSize: "lab:font-size",
  compactSidebar: "sidebar-collapsed", // reuses the sidebar's existing key
} as const;

export const PERSONALIZATION_EVENT = "lab:personalizationchange";

export function accentById(id: string): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/** Read the current personalization from localStorage (browser only). */
export function readPersonalization(): Personalization {
  if (typeof window === "undefined") return DEFAULT_PERSONALIZATION;
  const get = (k: string, fallback: string) => {
    try {
      return localStorage.getItem(k) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const accent = get(STORAGE_KEYS.accent, DEFAULT_PERSONALIZATION.accent);
  const density = get(
    STORAGE_KEYS.density,
    DEFAULT_PERSONALIZATION.density,
  ) as Density;
  const fontSize = get(
    STORAGE_KEYS.fontSize,
    DEFAULT_PERSONALIZATION.fontSize,
  ) as FontSize;
  const compactSidebar = get(STORAGE_KEYS.compactSidebar, "0") === "1";
  return { accent, density, fontSize, compactSidebar };
}

// --- Reactive snapshot (for useSyncExternalStore) --------------------------
let cacheKey = "";
let cacheVal: Personalization = DEFAULT_PERSONALIZATION;

/** Cached snapshot so getSnapshot returns a stable reference while unchanged. */
export function getPersonalizationSnapshot(): Personalization {
  if (typeof window === "undefined") return DEFAULT_PERSONALIZATION;
  const p = readPersonalization();
  const key = `${p.accent}|${p.density}|${p.fontSize}|${p.compactSidebar}`;
  if (key !== cacheKey) {
    cacheKey = key;
    cacheVal = p;
  }
  return cacheVal;
}

export function getServerPersonalizationSnapshot(): Personalization {
  return DEFAULT_PERSONALIZATION;
}

export function subscribePersonalization(cb: () => void): () => void {
  window.addEventListener(PERSONALIZATION_EVENT, cb);
  window.addEventListener("lab:sidebarchange", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PERSONALIZATION_EVENT, cb);
    window.removeEventListener("lab:sidebarchange", cb);
    window.removeEventListener("storage", cb);
  };
}

/** Apply personalization to the document element (data-attributes). */
export function applyPersonalization(p: Personalization): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-accent", p.accent);
  el.setAttribute("data-density", p.density);
  el.setAttribute("data-font", p.fontSize);
}

/**
 * Inline script that applies the saved personalization before first paint (same
 * pattern as themeScript). Rendered in <head>.
 */
export const personalizationScript = `
(function () {
  try {
    var el = document.documentElement;
    el.setAttribute('data-accent', localStorage.getItem('${STORAGE_KEYS.accent}') || '${DEFAULT_PERSONALIZATION.accent}');
    el.setAttribute('data-density', localStorage.getItem('${STORAGE_KEYS.density}') || '${DEFAULT_PERSONALIZATION.density}');
    el.setAttribute('data-font', localStorage.getItem('${STORAGE_KEYS.fontSize}') || '${DEFAULT_PERSONALIZATION.fontSize}');
  } catch (e) {}
})();
`;
