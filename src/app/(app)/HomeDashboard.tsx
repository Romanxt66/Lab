"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles, LayoutGrid, Clock } from "lucide-react";
import { TOOLS, isToolVisible, type ToolMeta } from "@/modules/registry";
import { cn } from "@/lib/utils";
import { PersonalizationPanel } from "@/components/personalization-panel";
import {
  subscribeUsage,
  getVisitsSnapshot,
  getServerVisitsSnapshot,
  summarize,
} from "@/lib/usage";

export function HomeDashboard({ role }: { role?: string }) {
  const READY = React.useMemo(
    () => TOOLS.filter((t) => t.status === "ready" && isToolVisible(t, role)),
    [role],
  );
  const BY_SLUG = React.useMemo(
    () => new Map(READY.map((t) => [t.slug, t])),
    [READY],
  );

  // Reactive usage snapshot (localStorage), hydration-safe via server snapshot.
  const visits = React.useSyncExternalStore(
    subscribeUsage,
    getVisitsSnapshot,
    getServerVisitsSnapshot,
  );
  const usage = React.useMemo(() => summarize(visits), [visits]);

  const topTools = usage.top
    .map((t) => BY_SLUG.get(t.slug))
    .filter((t): t is ToolMeta => Boolean(t))
    .slice(0, 4);

  const recentTools = usage.recent
    .map((v) => ({ tool: BY_SLUG.get(v.slug), at: v.at }))
    .filter((r): r is { tool: ToolMeta; at: number } => Boolean(r.tool))
    .slice(0, 6);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Main column */}
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<Sparkles className="size-4" />}
            label="Usadas hoy"
            value={String(usage.todayCount)}
          />
          <StatCard
            icon={<LayoutGrid className="size-4" />}
            label="Herramientas"
            value={String(READY.length)}
          />
          <StatCard
            icon={<Clock className="size-4" />}
            label="Más usada"
            value={topTools[0]?.name ?? "—"}
            small
          />
        </div>

        {/* Most used */}
        {topTools.length > 0 ? (
          <section>
            <SectionTitle>Más usadas</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {topTools.map((tool, i) => (
                <CompactTile key={tool.slug} tool={tool} index={i} />
              ))}
            </div>
          </section>
        ) : null}

        {/* All tools */}
        <section>
          <SectionTitle>Herramientas</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {READY.map((tool, i) => (
              <QuickAccessTile key={tool.slug} tool={tool} index={i} />
            ))}
          </div>
        </section>
      </div>

      {/* Aside */}
      <aside className="space-y-6">
        <PersonalizationPanel />

        <div className="glass rounded-xl border border-border/60 p-5">
          <h2 className="text-sm font-semibold">Actividad reciente</h2>
          {recentTools.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Abre una herramienta y aparecerá aquí.
            </p>
          ) : (
            <ul className="mt-3 space-y-1">
              {recentTools.map(({ tool, at }) => {
                const Icon = tool.icon;
                return (
                  <li key={tool.slug}>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="group/act flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-foreground/5"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/act:text-foreground" />
                      <span className="flex-1 truncate">{tool.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeTime(at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function StatCard({
  icon,
  label,
  value,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="glass rounded-xl border border-border/60 p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="accent-text">{icon}</span>
        {label}
      </div>
      <p
        className={cn(
          "mt-2 font-semibold tabular-nums",
          small ? "truncate text-base" : "text-2xl",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CompactTile({ tool, index }: { tool: ToolMeta; index: number }) {
  const Icon = tool.icon;
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div
        className="animate-enter-stagger group glass flex items-center gap-3 rounded-lg border border-border/60 p-3.5 transition-[transform,border-color] duration-300 [transition-timing-function:var(--ease-out)] hover:-translate-y-0.5 hover:border-foreground/25"
        style={{ "--i": Math.min(index, 6) } as CSSProperties}
      >
        <span className="accent-soft flex size-9 items-center justify-center rounded-lg accent-text transition-transform duration-300 [transition-timing-function:var(--ease-out)] group-hover:scale-105">
          <Icon className="size-[18px]" />
        </span>
        <span className="truncate text-sm font-medium">{tool.name}</span>
      </div>
    </Link>
  );
}

function QuickAccessTile({ tool, index }: { tool: ToolMeta; index: number }) {
  const Icon = tool.icon;
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div
        className={cn(
          "animate-enter-stagger group relative flex h-full flex-col justify-between overflow-hidden rounded-lg glass border border-border/60 p-5 shadow-sm",
          "transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:var(--ease-out)] will-change-transform",
          "hover:-translate-y-1 hover:border-foreground/25 hover:shadow-lg",
        )}
        style={{ "--i": Math.min(index, 6) } as CSSProperties}
      >
        <div className="mb-6 flex items-start justify-between">
          <span className="accent-soft flex size-11 items-center justify-center rounded-lg accent-text transition-transform duration-300 [transition-timing-function:var(--ease-out)] group-hover:scale-105">
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

/** Compact relative time in Spanish: "ahora", "5 min", "3 h", "2 d". */
function relativeTime(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
