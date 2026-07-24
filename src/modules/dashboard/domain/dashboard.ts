import type { WidgetType, LayoutBox } from "./widget-types";

export interface Widget {
  id: string;
  dashboardId: string;
  type: WidgetType;
  title: string;
  config: string; // JSON
  layout: LayoutBox;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dashboard {
  id: string;
  name: string;
  order: number;
  widgets: Widget[];
  createdAt: Date;
  updatedAt: Date;
}

// ---- DTOs (client-safe) ---------------------------------------------------

export interface WidgetDTO {
  id: string;
  type: WidgetType;
  title: string;
  config: string;
  layout: LayoutBox;
}

export interface DashboardDTO {
  id: string;
  name: string;
  order: number;
  widgets: WidgetDTO[];
}

export function toWidgetDTO(w: Widget): WidgetDTO {
  return {
    id: w.id,
    type: w.type,
    title: w.title,
    config: w.config,
    layout: w.layout,
  };
}

export function toDashboardDTO(d: Dashboard): DashboardDTO {
  return {
    id: d.id,
    name: d.name,
    order: d.order,
    widgets: d.widgets.map(toWidgetDTO),
  };
}
