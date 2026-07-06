"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/modules/registry";

const CATEGORY_ORDER: ToolCategory[] = [
  "dev-utils",
  "calendar",
  "email",
  "notifications",
  "scraper",
  "scheduler",
];

const STORAGE_KEY = "sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  // Restore the saved state after mount (avoids hydration mismatch).
  React.useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "glass flex h-full shrink-0 flex-col overflow-hidden border-r border-border/70",
        "transition-[width] duration-300 [transition-timing-function:var(--ease-out)]",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      {/* Brand */}
      <Link
        href="/"
        title="Lab"
        className={cn(
          "group flex items-center gap-2.5 py-5 text-[15px] font-semibold tracking-tight",
          collapsed ? "justify-center px-0" : "px-5",
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform duration-300 [transition-timing-function:var(--ease-out)] group-hover:scale-105">
          <FlaskConical className="size-4" />
        </span>
        {!collapsed ? <span className="whitespace-nowrap">Lab</span> : null}
      </Link>

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto pb-4", collapsed ? "px-2" : "px-3")}>
        {CATEGORY_ORDER.map((catId) => {
          const cat = CATEGORIES[catId];
          const tools = TOOLS.filter((t) => t.category === catId);
          if (tools.length === 0) return null;
          const CatIcon = cat.icon;
          return (
            <div key={catId} className="mb-5">
              {collapsed ? (
                <div className="mb-1 flex justify-center py-1 text-muted-foreground/70">
                  <CatIcon className="size-3.5" />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2 pb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <CatIcon className="size-3.5" />
                  {cat.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {tools.map((tool) => {
                  const href = `/tools/${tool.slug}`;
                  const active = pathname === href;
                  const Icon = tool.icon;
                  return (
                    <li key={tool.slug}>
                      <Link
                        href={href}
                        title={collapsed ? tool.name : undefined}
                        className={cn(
                          "flex items-center rounded-md text-sm transition-[color,background-color] duration-200 [transition-timing-function:var(--ease-out)]",
                          collapsed
                            ? "justify-center px-0 py-2"
                            : "gap-2.5 px-2.5 py-1.5",
                          active
                            ? "bg-foreground/10 font-medium text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {!collapsed ? (
                          <span className="truncate">{tool.name}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
        title={collapsed ? "Expandir" : "Contraer"}
        className={cn(
          "m-2 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-[color,background-color] duration-200 [transition-timing-function:var(--ease-out)] hover:bg-foreground/5 hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4 shrink-0" />
        ) : (
          <PanelLeftClose className="size-4 shrink-0" />
        )}
        {!collapsed ? <span>Contraer</span> : null}
      </button>
    </aside>
  );
}
