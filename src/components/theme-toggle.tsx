"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Toggles `.dark` on <html> and persists the choice to localStorage. */
export function ThemeToggle() {
  const [dark, setDark] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
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
      {dark === null ? null : dark ? <Sun /> : <Moon />}
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
