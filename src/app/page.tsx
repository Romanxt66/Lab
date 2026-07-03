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
      <header className="mb-10">
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
                  {tools.map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} />
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

function ToolCard({ tool }: { tool: (typeof TOOLS)[number] }) {
  const Icon = tool.icon;
  const disabled = tool.status === "soon";

  const inner = (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-all duration-150",
        disabled
          ? "opacity-60"
          : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-[18px]" />
        </span>
        {disabled ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Pronto
          </span>
        ) : (
          <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
        )}
      </div>
      <h3 className="font-medium leading-tight">{tool.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
    </div>
  );

  if (disabled) return inner;
  return (
    <Link href={`/tools/${tool.slug}`} className="focus-visible:outline-none">
      {inner}
    </Link>
  );
}
