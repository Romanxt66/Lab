import { type Result, ok, err } from "@/shared/kernel/result";
import type {
  DashboardRepoPort,
  WidgetRepoPort,
  WidgetDataProvider,
} from "./ports";
import type { Dashboard, Widget } from "@/modules/dashboard/domain/dashboard";
import {
  DEFAULT_LAYOUT,
  type WidgetType,
  type LayoutBox,
} from "@/modules/dashboard/domain/widget-types";

/**
 * DashboardService orchestrates the dashboard's CRUD + data loading. Provider
 * lookup is table-driven: whenever a new widget type is added, register it in
 * the container's provider map.
 */
export class DashboardService {
  constructor(
    private readonly dashboards: DashboardRepoPort,
    private readonly widgets: WidgetRepoPort,
    private readonly providers: Partial<Record<WidgetType, WidgetDataProvider>>,
  ) {}

  // ---- Dashboards --------------------------------------------------------

  async list(): Promise<Dashboard[]> {
    return this.dashboards.list();
  }

  async createDashboard(name: string): Promise<Result<Dashboard>> {
    if (!name.trim()) return err("El dashboard necesita un nombre.");
    const existing = await this.dashboards.list();
    const order = existing.length;
    return ok(
      await this.dashboards.create({ name: name.trim(), order }),
    );
  }

  async renameDashboard(id: string, name: string): Promise<Result<Dashboard>> {
    if (!name.trim()) return err("El nombre no puede estar vacío.");
    return ok(await this.dashboards.rename(id, name.trim()));
  }

  async removeDashboard(id: string): Promise<void> {
    await this.dashboards.remove(id);
  }

  // ---- Widgets -----------------------------------------------------------

  async addWidget(input: {
    dashboardId: string;
    type: WidgetType;
    title: string;
    config?: string;
  }): Promise<Result<Widget>> {
    if (!input.title.trim()) return err("El widget necesita un título.");
    return ok(
      await this.widgets.create({
        dashboardId: input.dashboardId,
        type: input.type,
        title: input.title.trim(),
        config: input.config ?? "{}",
        layout: DEFAULT_LAYOUT[input.type],
      }),
    );
  }

  async updateWidget(
    id: string,
    input: { title?: string; config?: string; layout?: LayoutBox },
  ): Promise<Result<Widget>> {
    if (input.title !== undefined && !input.title.trim()) {
      return err("El título no puede estar vacío.");
    }
    return ok(await this.widgets.update(id, input));
  }

  async removeWidget(id: string): Promise<void> {
    await this.widgets.remove(id);
  }

  // ---- Data --------------------------------------------------------------

  async loadWidgetData(widget: Widget): Promise<Result<unknown>> {
    const provider = this.providers[widget.type];
    if (!provider) {
      return err(`Tipo de widget no soportado: ${widget.type}`);
    }
    return provider.provide(widget);
  }
}
