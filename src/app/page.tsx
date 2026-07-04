import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/modules/registry";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: ToolCategory[] = [
  "dev-utils",
  "email",
  "scraper",
  "scheduler",
];

export default function DashboardPage() {
  const hasTools = TOOLS.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="animate-enter mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Tu Lab</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Herramientas y automatizaciones para tu día a día como programador.
        </p>
      </header>

      {!hasTools ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no hay herramientas registradas. Se irán añadiendo por fases.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {CATEGORY_ORDER.map((catId) => {
            const cat = CATEGORIES[catId];
            const tools = TOOLS.filter((t) => t.category === catId);
            if (tools.length === 0) return null;
            const CatIcon = cat.icon;
            return (
              <section key={catId}>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CatIcon className="size-4" />
                  {cat.label}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool, i) => (
                    <ToolCard key={tool.slug} tool={tool} index={i} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ToolCard({
  tool,
  index,
}: {
  tool: (typeof TOOLS)[number];
  index: number;
}) {
  const Icon = tool.icon;
  const disabled = tool.status === "soon";

  const inner = (
    <div
      className={cn(
        "animate-enter-stagger group relative flex h-full flex-col overflow-hidden rounded-lg glass border border-border/60 p-5 shadow-sm",
        "transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:var(--ease-out)] will-change-transform",
        disabled
          ? "opacity-60"
          : "hover:-translate-y-1 hover:border-foreground/25 hover:shadow-lg",
      )}
      // Cap stagger contribution so late cards don't lag (max ~6 steps).
      style={{ "--i": Math.min(index, 6) } as CSSProperties}
    >
      {/* Sheen that sweeps across on hover — the one "delight" touch. */}
      {!disabled ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent opacity-0 transition-[transform,opacity] duration-700 [transition-timing-function:var(--ease-out)] group-hover:translate-x-full group-hover:opacity-100"
        />
      ) : null}
      <div className="mb-3 flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-md border border-border/60 bg-foreground/5 text-foreground transition-transform duration-300 [transition-timing-function:var(--ease-out)] group-hover:scale-105">
          <Icon className="size-[18px]" />
        </span>
        {disabled ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Pronto
          </span>
        ) : (
          <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-[transform,opacity] duration-300 [transition-timing-function:var(--ease-out)] group-hover:translate-x-0 group-hover:opacity-100" />
        )}
      </div>
      <h3 className="font-medium leading-tight">{tool.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
    </div>
  );

  if (disabled) return inner;
  return (
    <Link href={`/tools/${tool.slug}`} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      {inner}
    </Link>
  );
}
