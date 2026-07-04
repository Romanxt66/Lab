"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/modules/registry";

const CATEGORY_ORDER: ToolCategory[] = [
  "dev-utils",
  "email",
  "scraper",
  "scheduler",
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass flex h-full w-64 shrink-0 flex-col border-r border-border/70">
      <Link
        href="/"
        className="group flex items-center gap-2.5 px-5 py-5 text-[15px] font-semibold tracking-tight"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform duration-300 [transition-timing-function:var(--ease-out)] group-hover:scale-105">
          <FlaskConical className="size-4" />
        </span>
        Lab
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {CATEGORY_ORDER.map((catId) => {
          const cat = CATEGORIES[catId];
          const tools = TOOLS.filter((t) => t.category === catId);
          if (tools.length === 0) return null;
          const CatIcon = cat.icon;
          return (
            <div key={catId} className="mb-5">
              <div className="flex items-center gap-2 px-2 pb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <CatIcon className="size-3.5" />
                {cat.label}
              </div>
              <ul className="space-y-0.5">
                {tools.map((tool) => {
                  const href = `/tools/${tool.slug}`;
                  const active = pathname === href;
                  const Icon = tool.icon;
                  return (
                    <li key={tool.slug}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-[color,background-color] duration-200 [transition-timing-function:var(--ease-out)]",
                          active
                            ? "bg-foreground/10 font-medium text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {tool.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
