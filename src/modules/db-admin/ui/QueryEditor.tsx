"use client";

import * as React from "react";
import {
  Play,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  runQueryAction,
  analyzeSqlAction,
} from "@/modules/db-admin/actions";
import type { QueryResult } from "@/modules/db-admin/application/ports";
import { cn } from "@/lib/utils";

interface Props {
  connectionId: string;
  /** Callback used by the parent to inject SQL from the schema tree. */
  initialSql?: string;
  onSqlChange?: (sql: string) => void;
}

export function QueryEditor({ connectionId, initialSql = "", onSqlChange }: Props) {
  const [sql, setSql] = React.useState(initialSql);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [analyzed, setAnalyzed] = React.useState<{
    risk: "safe" | "modifying" | "destructive";
    isUnbounded: boolean;
    keyword?: string;
  } | null>(null);

  React.useEffect(() => {
    // Deferred so it isn't a synchronous setState in the effect.
    queueMicrotask(() => setSql(initialSql));
  }, [initialSql]);

  React.useEffect(() => {
    onSqlChange?.(sql);
  }, [sql, onSqlChange]);

  // Live risk analysis so the "Ejecutar" button reflects danger.
  React.useEffect(() => {
    if (!sql.trim()) return;
    let cancelled = false;
    void analyzeSqlAction(sql).then((a) => {
      if (!cancelled) setAnalyzed(a);
    });
    return () => {
      cancelled = true;
    };
  }, [sql]);

  // No analysis to show for an empty query.
  const analysis = sql.trim() ? analyzed : null;

  async function run(confirmDestructive = false) {
    if (!connectionId) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await runQueryAction(connectionId, sql, confirmDestructive);
      if (res.ok) setResult(res.value);
      else setError(res.error);
    } finally {
      setRunning(false);
    }
  }

  async function onExecute() {
    if (analysis?.risk === "destructive") {
      const label = analysis.isUnbounded
        ? `${analysis.keyword} sin WHERE afectará TODAS las filas.`
        : `Vas a ejecutar ${analysis.keyword}.`;
      if (!window.confirm(`${label}\n\n¿Continuar?`)) return;
      await run(true);
    } else {
      await run(false);
    }
  }

  // Ctrl/Cmd + Enter to run.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void onExecute();
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={"SELECT * FROM public.usuarios LIMIT 100;\n\n-- Ctrl/Cmd + Enter para ejecutar"}
          className="min-h-40 font-mono text-[13px]"
          spellCheck={false}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onExecute}
            disabled={!connectionId || running || !sql.trim()}
            variant={analysis?.risk === "destructive" ? "danger" : "default"}
          >
            {running ? (
              <Loader2 className="animate-spin" />
            ) : analysis?.risk === "destructive" ? (
              <AlertTriangle />
            ) : (
              <Play />
            )}
            Ejecutar
          </Button>

          {analysis ? (
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                analysis.risk === "safe" && "text-muted-foreground",
                analysis.risk === "modifying" && "text-warning",
                analysis.risk === "destructive" && "text-danger",
              )}
            >
              {analysis.risk === "safe"
                ? "SELECT"
                : analysis.risk === "modifying"
                  ? `${analysis.keyword} — modifica datos`
                  : analysis.isUnbounded
                    ? `⚠️ ${analysis.keyword} sin WHERE`
                    : `⚠️ ${analysis.keyword} — destructivo`}
            </span>
          ) : null}

          <span className="ml-auto text-[11px] text-muted-foreground">
            Ctrl/⌘+Enter
          </span>
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {result ? <ResultView result={result} /> : null}
    </div>
  );
}

function ResultView({ result }: { result: QueryResult }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-success" />
        {result.command} · {result.rowCount} fila{result.rowCount === 1 ? "" : "s"} ·{" "}
        {result.durationMs} ms
      </div>

      {result.columns.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Sin filas.
        </p>
      ) : (
        <div className="max-h-[480px] overflow-auto rounded-md border border-border">
          <table className="w-full min-w-max text-xs">
            <thead className="sticky top-0 bg-background/95 backdrop-blur">
              <tr className="border-b border-border">
                {result.columns.map((c, i) => (
                  <th
                    key={c + i}
                    className="whitespace-nowrap px-2 py-1.5 text-left font-medium"
                  >
                    {c}
                    <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                      {result.columnTypes[i]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={cn(
                    "border-b border-border/40 last:border-0",
                    ri % 2 === 1 && "bg-muted/20",
                  )}
                >
                  {row.map((cell, ci) => (
                    <Cell key={ci} value={cell} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Cell({ value }: { value: unknown }) {
  const [copied, setCopied] = React.useState(false);
  const display = React.useMemo(() => renderCell(value), [value]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(display.raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <td className="group relative max-w-md whitespace-nowrap px-2 py-1 font-mono">
      <span
        className={cn(
          "truncate",
          display.tone === "null" && "italic text-muted-foreground",
          display.tone === "json" && "text-info",
        )}
        title={display.raw}
      >
        {display.text}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copiar"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground group-hover:opacity-100"
      >
        {copied ? (
          <CheckCircle2 className="size-3 text-success" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </td>
  );
}

function renderCell(
  value: unknown,
): { text: string; raw: string; tone: "null" | "json" | "text" } {
  if (value === null || value === undefined) {
    return { text: "NULL", raw: "", tone: "null" };
  }
  if (typeof value === "object") {
    const raw = JSON.stringify(value);
    return { text: raw, raw, tone: "json" };
  }
  const s = String(value);
  return { text: s, raw: s, tone: "text" };
}
