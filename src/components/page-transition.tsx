"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps the app's main content and replays a quick enter animation on every
 * route change. Keying the wrapper by pathname remounts it on navigation, so
 * the CSS `.page-enter` animation fires each time — a subtle crossfade that
 * makes moving between tools feel connected rather than instant/janky.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter h-full">
      {children}
    </div>
  );
}
