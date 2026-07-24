import { type Result, ok, err } from "@/shared/kernel/result";
import type { WidgetDataProvider } from "./ports";
import type { Widget } from "@/modules/dashboard/domain/dashboard";
import { parseWidgetConfig } from "@/modules/dashboard/domain/widget-types";
import type { DbAdminService } from "@/modules/db-admin/application/db-admin-service";
import { analyzeSql } from "@/modules/db-admin/domain/sql-analysis";

/**
 * Base class for widgets backed by SQL against a saved DB-Admin connection.
 * Enforces read-only semantics regardless of the underlying connection: the
 * dashboard should never mutate anything, even if the user picked a
 * writeable connection.
 */
abstract class SqlBackedProvider {
  constructor(protected readonly dbAdmin: DbAdminService) {}

  protected async runReadOnly(
    connectionId: string,
    sql: string,
  ): Promise<
    | { ok: false; error: string }
    | { ok: true; result: import("@/modules/db-admin/application/ports").QueryResult }
  > {
    // Belt-and-braces: reject any non-safe query before it reaches the DB.
    const analysis = analyzeSql(sql);
    if (analysis.risk !== "safe") {
      return {
        ok: false,
        error:
          "Los widgets solo permiten consultas SELECT. Elimina cualquier INSERT/UPDATE/DELETE/etc.",
      };
    }
    // We still pass the id/sql to DbAdminService, which itself refuses
    // destructive without confirmation and honours the connection's readOnly
    // flag if set.
    const r = await this.dbAdmin.runQuery(connectionId, sql, {});
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, result: r.value };
  }
}

// ---- Metric (single number) ----------------------------------------------

export interface MetricData {
  value: string;
  label?: string;
}

export class SqlMetricProvider extends SqlBackedProvider implements WidgetDataProvider {
  async provide(widget: Widget): Promise<Result<MetricData>> {
    const config = parseWidgetConfig(widget.config);
    if (!config.connectionId) return err("El widget no tiene una conexión asignada.");
    if (!config.sql) return err("El widget no tiene una consulta SQL.");

    const r = await this.runReadOnly(config.connectionId, config.sql);
    if (!r.ok) return err(r.error);

    const first = r.result.rows[0];
    if (first === undefined) return ok({ value: "—" });
    const cell = first[0];
    return ok({
      value: cell === null || cell === undefined ? "null" : String(cell),
      label: r.result.columns[0],
    });
  }
}

// ---- Chart (bar / line) --------------------------------------------------

export interface ChartData {
  chartType: "bar" | "line";
  xColumn: string;
  yColumn: string;
  points: Array<{ x: string; y: number }>;
}

export class SqlChartProvider extends SqlBackedProvider implements WidgetDataProvider {
  async provide(widget: Widget): Promise<Result<ChartData>> {
    const config = parseWidgetConfig(widget.config);
    if (!config.connectionId) return err("El widget no tiene una conexión asignada.");
    if (!config.sql) return err("El widget no tiene una consulta SQL.");
    const chartType = config.chartType ?? "bar";

    const r = await this.runReadOnly(config.connectionId, config.sql);
    if (!r.ok) return err(r.error);

    if (r.result.columns.length < 2) {
      return err(
        "La consulta debe devolver al menos 2 columnas (x, y).",
      );
    }
    // Default: first column = x, second column = y. Config can override.
    const xIndex = config.xColumn
      ? r.result.columns.indexOf(config.xColumn)
      : 0;
    const yIndex = config.yColumn
      ? r.result.columns.indexOf(config.yColumn)
      : 1;
    if (xIndex < 0 || yIndex < 0) {
      return err("Las columnas X/Y indicadas no existen en el resultado.");
    }

    const points = r.result.rows
      .map((row) => ({
        x: String(row[xIndex] ?? ""),
        y: Number(row[yIndex]),
      }))
      .filter((p) => Number.isFinite(p.y));

    return ok({
      chartType,
      xColumn: r.result.columns[xIndex],
      yColumn: r.result.columns[yIndex],
      points,
    });
  }
}

// ---- Table ---------------------------------------------------------------

export interface TableData {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

export class SqlTableProvider extends SqlBackedProvider implements WidgetDataProvider {
  async provide(widget: Widget): Promise<Result<TableData>> {
    const config = parseWidgetConfig(widget.config);
    if (!config.connectionId) return err("El widget no tiene una conexión asignada.");
    if (!config.sql) return err("El widget no tiene una consulta SQL.");

    const r = await this.runReadOnly(config.connectionId, config.sql);
    if (!r.ok) return err(r.error);
    return ok({
      columns: r.result.columns,
      rows: r.result.rows,
      rowCount: r.result.rowCount,
    });
  }
}
