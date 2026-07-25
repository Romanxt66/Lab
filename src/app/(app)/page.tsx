import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TOOLS } from "@/modules/registry";
import { getCurrentUser } from "@/modules/auth/current-user";
import { cn } from "@/lib/utils";
import { HomeHeader } from "./HomeHeader";

/**
 * Home / menu. Minimalist landing after login: a warm greeting and a single
 * grid of quick-access tiles for every tool. Categories are intentionally
 * flattened — the sidebar already groups things by category, the home is a
 * frictionless launcher.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  const displayName = user?.name || user?.email?.split("@")[0] || null;

  const ready = TOOLS.filter((t) => t.status === "ready");

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="animate-enter mb-10">
        <HomeHeader name={displayName} />
        <p className="mt-2 text-[15px] text-muted-foreground">
          Elige una herramienta para empezar.
        </p>
      </header>

      {ready.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no hay herramientas registradas.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ready.map((tool, i) => (
            <QuickAccessTile key={tool.slug} tool={tool} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAccessTile({
  tool,
  index,
}: {
  tool: (typeof TOOLS)[number];
  index: number;
}) {
  const Icon = tool.icon;

  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
    >
      <div
        className={cn(
          "animate-enter-stagger group relative flex h-full flex-col justify-between overflow-hidden rounded-lg glass border border-border/60 p-5 shadow-sm",
          "transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:var(--ease-out)] will-change-transform",
          "hover:-translate-y-1 hover:border-foreground/25 hover:shadow-lg",
        )}
        // Cap stagger contribution so late cards don't lag (max ~6 steps).
        style={{ "--i": Math.min(index, 6) } as CSSProperties}
      >
        <div className="mb-6 flex items-start justify-between">
          <span className="flex size-11 items-center justify-center rounded-lg border border-border/60 bg-foreground/5 text-foreground transition-transform duration-300 [transition-timing-function:var(--ease-out)] group-hover:scale-105">
            <Icon className="size-5" />
          </span>
          <ArrowUpRight className="size-4 -translate-x-1 translate-y-1 text-muted-foreground opacity-0 transition-[transform,opacity] duration-300 [transition-timing-function:var(--ease-out)] group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
        </div>
        <div>
          <h3 className="text-base font-medium leading-tight">{tool.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {tool.description}
          </p>
        </div>
      </div>
    </Link>
  );
}

