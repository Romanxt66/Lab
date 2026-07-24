"use client";

import { WidgetShell, useWidgetData, WidgetBody } from "./WidgetShell";
import type {
  MetricData,
  TableData,
} from "@/modules/dashboard/application/sql-providers";

// ---- Metric ---------------------------------------------------------------

export function SqlMetricWidget({
  widgetId,
  title,
  onDelete,
}: {
  widgetId: string;
  title: string;
  onDelete?: () => void | Promise<void>;
}) {
  const state = useWidgetData<MetricData>(widgetId);
  return (
    <WidgetShell widgetId={widgetId} title={title} onDelete={onDelete}>
      <WidgetBody state={state} emptyMessage="—">
        {(data) => (
          <div className="flex h-full flex-col justify-center">
            <p className="text-3xl font-semibold tabular-nums leading-none">
              {formatNumberish(data.value)}
            </p>
            {data.label ? (
              <p className="mt-1 text-xs text-muted-foreground">{data.label}</p>
            ) : null}
          </div>
        )}
      </WidgetBody>
    </WidgetShell>
  );
}

// ---- Table ---------------------------------------------------------------

export function SqlTableWidget({
  widgetId,
  title,
  onDelete,
}: {
  widgetId: string;
  title: string;
  onDelete?: () => void | Promise<void>;
}) {
  const state = useWidgetData<TableData>(widgetId);
  return (
    <WidgetShell widgetId={widgetId} title={title} onDelete={onDelete}>
      <WidgetBody state={state} emptyMessage="Sin filas.">
        {(data) => (
          <div className="h-full overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-background/95">
                <tr className="text-left">
                  {data.columns.map((c, i) => (
                    <th
                      key={i}
                      className="whitespace-nowrap border-b border-border/60 px-2 py-1 font-medium"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-border/40">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="max-w-[220px] truncate px-2 py-1 align-top font-mono text-[11px]"
                        title={renderCell(cell)}
                      >
                        {cell === null ? (
                          <span className="italic text-muted-foreground">null</span>
                        ) : (
                          renderCell(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WidgetBody>
    </WidgetShell>
  );
}

function renderCell(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Format an integer-like string with thousands separators; leave other strings alone. */
function formatNumberish(raw: string): string {
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && /^-?\d+(\.\d+)?$/.test(raw)) {
    return new Intl.NumberFormat("es").format(asNum);
  }
  return raw;
}
