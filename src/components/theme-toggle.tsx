"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";

const THEME_EVENT = "lab:themechange";

function subscribeTheme(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
}

function isDark() {
  return document.documentElement.classList.contains("dark");
}

/** Toggles `.dark` on <html> and persists the choice to localStorage. */
export function ThemeToggle() {
  const hydrated = useHydrated();
  // The current theme lives on the <html> element (an external store); read it
  // reactively so a toggle re-renders the icon without a setState-in-effect.
  const dark = React.useSyncExternalStore(subscribeTheme, isDark, () => false);

  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Cambiar tema"
      title="Cambiar tema"
    >
      {/* Avoid hydration mismatch: render nothing until mounted */}
      {!hydrated ? null : dark ? <Sun /> : <Moon />}
    </Button>
  );
}

/**
 * Inline script that applies the saved theme before first paint to avoid a
 * flash of the wrong theme. Rendered in <head>.
 */
export const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    var d = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', d);
  } catch (e) {}
})();
`;
