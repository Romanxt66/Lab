"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  monthlySummaryAction,
  type AccountWithBalanceDTO,
} from "@/modules/finance/actions";
import type { CategoryDTO } from "@/modules/finance/domain/category";
import type { MonthlySummary } from "@/modules/finance/domain/balance";
import { formatMoney } from "./format";
import { cn } from "@/lib/utils";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function SummaryPanel({
  accounts,
  categories,
}: {
  accounts: AccountWithBalanceDTO[];
  categories: CategoryDTO[];
}) {
  // Start with today's month; recompute when the user pages.
  const [ym, setYm] = React.useState<{ y: number; m: number } | null>(null);
  const [summary, setSummary] = React.useState<MonthlySummary | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Compute "current month" client-side to avoid hydration mismatches
  // (the server's clock/timezone can differ from the browser's).
  React.useEffect(() => {
    if (ym) return;
    const now = new Date();
    setYm({ y: now.getFullYear(), m: now.getMonth() + 1 });
  }, [ym]);

  React.useEffect(() => {
    if (!ym) return;
    setLoading(true);
    void monthlySummaryAction(ym.y, ym.m)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [ym]);

  const currency = accounts[0]?.account.currency ?? "USD";
  const categoryLookup = React.useMemo(() => {
    const map = new Map<string, CategoryDTO>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  if (!ym) return null;

  const expenseBreakdown =
    summary?.byCategory
      .filter((row) => row.amount < 0)
      .map((row) => ({
        ...row,
        amount: Math.abs(row.amount),
        name:
          (row.categoryId && categoryLookup.get(row.categoryId)?.name) ??
          "Sin categoría",
      }))
      .sort((a, b) => b.amount - a.amount) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium capitalize">
          {MONTHS[ym.m - 1]} {ym.y}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setYm((cur) => {
                if (!cur) return cur;
                return cur.m === 1
                  ? { y: cur.y - 1, m: 12 }
                  : { y: cur.y, m: cur.m - 1 };
              })
            }
            aria-label="Mes anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date();
              setYm({ y: now.getFullYear(), m: now.getMonth() + 1 });
            }}
          >
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setYm((cur) => {
                if (!cur) return cur;
                return cur.m === 12
                  ? { y: cur.y + 1, m: 1 }
                  : { y: cur.y, m: cur.m + 1 };
              })
            }
            aria-label="Mes siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {loading || !summary ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : (
        <>
          {/* Top-line cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={<TrendingUp className="size-4 text-success" />}
              label="Ingresos"
              value={formatMoney(summary.income, currency)}
            />
            <SummaryCard
              icon={<TrendingDown className="size-4 text-danger" />}
              label="Gastos"
              value={formatMoney(summary.expense, currency)}
            />
            <SummaryCard
              label="Balance"
              value={formatMoney(summary.net, currency)}
              tone={summary.net < 0 ? "negative" : "positive"}
            />
          </div>

          {/* Expense breakdown */}
          <div className="glass rounded-lg border border-border/60 p-4">
            <h3 className="mb-3 text-sm font-medium">Gastos por categoría</h3>
            {expenseBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin gastos este mes.
              </p>
            ) : (
              <>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={expenseBreakdown}
                      layout="vertical"
                      margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={96}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--foreground)", opacity: 0.05 }}
                        content={<ExpenseTooltip currency={currency} />}
                      />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={18}>
                        {expenseBreakdown.map((row) => (
                          <Cell
                            key={row.categoryId ?? "none"}
                            fill="var(--foreground)"
                            fillOpacity={0.55}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-1">
                  {expenseBreakdown.map((row) => (
                    <li
                      key={row.categoryId ?? "none"}
                      className="flex items-baseline justify-between text-sm"
                    >
                      <span className="truncate text-muted-foreground">
                        {row.name}
                      </span>
                      <span className="tabular-nums">
                        {formatMoney(row.amount, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface TooltipEntry {
  payload: { name: string; amount: number };
}
function ExpenseTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="glass rounded-md border border-border/60 px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{row.name}</p>
      <p className="tabular-nums text-muted-foreground">
        {formatMoney(row.amount, currency)}
      </p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="glass rounded-lg border border-border/60 p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          tone === "negative" && "text-danger",
          tone === "positive" && "text-success",
        )}
      >
        {value}
      </p>
    </div>
  );
}
