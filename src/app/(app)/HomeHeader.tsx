"use client";

import * as React from "react";

/**
 * Client-side greeting: relies on "now" which the server can't safely render
 * without triggering hydration mismatches (server time vs client time). We
 * paint a static skeleton on first render and swap in the greeting on mount.
 */
export function HomeHeader({ name }: { name: string | null }) {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
  }, []);

  const greeting = now ? personalGreeting(now, name) : "Bienvenido";
  const date = now ? formatDate(now) : " "; // non-breaking space keeps layout

  return (
    <>
      <p className="text-sm text-muted-foreground">{date}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {greeting}
      </h1>
    </>
  );
}

function personalGreeting(now: Date, name: string | null): string {
  const hour = now.getHours();
  const stem =
    hour < 6
      ? "Buenas noches"
      : hour < 12
        ? "Buenos días"
        : hour < 20
          ? "Buenas tardes"
          : "Buenas noches";
  return name ? `${stem}, ${name}` : stem;
}

function formatDate(d: Date): string {
  const raw = d.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
