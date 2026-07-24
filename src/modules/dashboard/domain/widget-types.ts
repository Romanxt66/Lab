/**
 * All widget types the dashboard understands. Splitting into "lab" (data from
 * within the Lab) and "sql" (data from a DB-Admin connection) keeps the
 * add-widget UI easy to organise.
 */
export type WidgetType =
  | "lab-upcoming-events"
  | "lab-recent-jobs"
  | "lab-google-accounts"
  | "lab-recent-emails"
  | "sql-metric"
  | "sql-table"
  | "sql-chart";

export const LAB_WIDGET_TYPES = [
  "lab-upcoming-events",
  "lab-recent-jobs",
  "lab-google-accounts",
  "lab-recent-emails",
] as const;

export const SQL_WIDGET_TYPES = [
  "sql-metric",
  "sql-table",
  "sql-chart",
] as const;

/**
 * Config shape (JSON, stored as string). Only fields relevant to each type
 * are populated — every field is optional so parsing legacy rows is easy.
 */
export interface WidgetConfig {
  // sql widgets
  connectionId?: string;
  sql?: string;
  // sql-table
  limit?: number;
  // sql-chart
  chartType?: "bar" | "line";
  xColumn?: string;
  yColumn?: string;
}

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Human-friendly labels for the "Add widget" picker. */
export const WIDGET_LABELS: Record<WidgetType, string> = {
  "lab-upcoming-events": "Próximos eventos (Calendario)",
  "lab-recent-jobs": "Últimos jobs ejecutados",
  "lab-google-accounts": "Cuentas de Google conectadas",
  "lab-recent-emails": "Últimos correos enviados",
  "sql-metric": "SQL · Contador",
  "sql-table": "SQL · Tabla de filas",
  "sql-chart": "SQL · Gráfica",
};

/** Default box (grid units) when a widget is first added. */
export const DEFAULT_LAYOUT: Record<WidgetType, LayoutBox> = {
  "lab-upcoming-events": { x: 0, y: 0, w: 6, h: 4 },
  "lab-recent-jobs": { x: 6, y: 0, w: 6, h: 4 },
  "lab-google-accounts": { x: 0, y: 4, w: 4, h: 3 },
  "lab-recent-emails": { x: 4, y: 4, w: 8, h: 3 },
  "sql-metric": { x: 0, y: 0, w: 3, h: 2 },
  "sql-table": { x: 0, y: 0, w: 8, h: 4 },
  "sql-chart": { x: 0, y: 0, w: 6, h: 4 },
};

/** Parse a config JSON safely; unknown fields are ignored. */
export function parseWidgetConfig(raw: string): WidgetConfig {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
