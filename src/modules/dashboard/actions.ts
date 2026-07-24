"use server";

import { type Result, ok } from "@/shared/kernel/result";
import { getDashboardService } from "@/shared/di/container";
import {
  toDashboardDTO,
  toWidgetDTO,
  type DashboardDTO,
  type WidgetDTO,
} from "@/modules/dashboard/domain/dashboard";
import type {
  WidgetType,
  LayoutBox,
} from "@/modules/dashboard/domain/widget-types";

// ---- Dashboards ----------------------------------------------------------

export async function listDashboardsAction(): Promise<DashboardDTO[]> {
  const list = await getDashboardService().list();
  return list.map(toDashboardDTO);
}

export async function createDashboardAction(
  name: string,
): Promise<Result<DashboardDTO>> {
  const res = await getDashboardService().createDashboard(name);
  return res.ok ? ok(toDashboardDTO(res.value)) : res;
}

export async function renameDashboardAction(
  id: string,
  name: string,
): Promise<Result<DashboardDTO>> {
  const res = await getDashboardService().renameDashboard(id, name);
  return res.ok ? ok(toDashboardDTO(res.value)) : res;
}

export async function deleteDashboardAction(id: string): Promise<void> {
  await getDashboardService().removeDashboard(id);
}

// ---- Widgets -------------------------------------------------------------

export async function addWidgetAction(input: {
  dashboardId: string;
  type: WidgetType;
  title: string;
  config?: string;
}): Promise<Result<WidgetDTO>> {
  const res = await getDashboardService().addWidget(input);
  return res.ok ? ok(toWidgetDTO(res.value)) : res;
}

export async function updateWidgetAction(
  id: string,
  input: { title?: string; config?: string; layout?: LayoutBox },
): Promise<Result<WidgetDTO>> {
  const res = await getDashboardService().updateWidget(id, input);
  return res.ok ? ok(toWidgetDTO(res.value)) : res;
}

export async function deleteWidgetAction(id: string): Promise<void> {
  await getDashboardService().removeWidget(id);
}

// ---- Data ----------------------------------------------------------------

export async function loadWidgetDataAction(
  widgetId: string,
): Promise<Result<unknown>> {
  // Look up the widget via the dashboards list — small dataset, no separate
  // "get widget by id" method needed.
  const svc = getDashboardService();
  const dashboards = await svc.list();
  for (const d of dashboards) {
    const found = d.widgets.find((w) => w.id === widgetId);
    if (found) return svc.loadWidgetData(found);
  }
  return { ok: false, error: "Widget no encontrado." };
}
