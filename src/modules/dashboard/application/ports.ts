import type { Result } from "@/shared/kernel/result";
import type { Dashboard, Widget } from "@/modules/dashboard/domain/dashboard";
import type { WidgetType, LayoutBox } from "@/modules/dashboard/domain/widget-types";

export interface DashboardRepoPort {
  list(): Promise<Dashboard[]>;
  get(id: string): Promise<Dashboard | null>;
  create(input: { name: string; order: number }): Promise<Dashboard>;
  rename(id: string, name: string): Promise<Dashboard>;
  remove(id: string): Promise<void>;
}

export interface WidgetRepoPort {
  create(input: {
    dashboardId: string;
    type: WidgetType;
    title: string;
    config: string;
    layout: LayoutBox;
  }): Promise<Widget>;
  update(
    id: string,
    input: { title?: string; config?: string; layout?: LayoutBox },
  ): Promise<Widget>;
  remove(id: string): Promise<void>;
}

/**
 * A widget data provider: given a stored widget, load whatever data it needs.
 * The router (WidgetDataService) dispatches to the right one by `type`.
 */
export interface WidgetDataProvider {
  provide(widget: Widget): Promise<Result<unknown>>;
}
