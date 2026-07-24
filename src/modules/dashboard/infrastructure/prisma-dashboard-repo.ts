import "server-only";
import { db } from "@/shared/db";
import type {
  DashboardRepoPort,
  WidgetRepoPort,
} from "@/modules/dashboard/application/ports";
import type {
  Dashboard,
  Widget,
} from "@/modules/dashboard/domain/dashboard";
import type {
  WidgetType,
  LayoutBox,
} from "@/modules/dashboard/domain/widget-types";

// Row → domain conversions ------------------------------------------------

function widgetRow(row: {
  id: string;
  dashboardId: string;
  type: string;
  title: string;
  config: string;
  layoutX: number;
  layoutY: number;
  layoutW: number;
  layoutH: number;
  createdAt: Date;
  updatedAt: Date;
}): Widget {
  return {
    id: row.id,
    dashboardId: row.dashboardId,
    type: row.type as WidgetType,
    title: row.title,
    config: row.config,
    layout: {
      x: row.layoutX,
      y: row.layoutY,
      w: row.layoutW,
      h: row.layoutH,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Repos --------------------------------------------------------------------

export class PrismaDashboardRepo implements DashboardRepoPort {
  async list(): Promise<Dashboard[]> {
    const rows = await db.dashboard.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: { widgets: { orderBy: { createdAt: "asc" } } },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      order: r.order,
      widgets: r.widgets.map(widgetRow),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async get(id: string): Promise<Dashboard | null> {
    const row = await db.dashboard.findUnique({
      where: { id },
      include: { widgets: { orderBy: { createdAt: "asc" } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      order: row.order,
      widgets: row.widgets.map(widgetRow),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(input: { name: string; order: number }): Promise<Dashboard> {
    const row = await db.dashboard.create({
      data: input,
      include: { widgets: true },
    });
    return {
      id: row.id,
      name: row.name,
      order: row.order,
      widgets: [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async rename(id: string, name: string): Promise<Dashboard> {
    const row = await db.dashboard.update({
      where: { id },
      data: { name },
      include: { widgets: { orderBy: { createdAt: "asc" } } },
    });
    return {
      id: row.id,
      name: row.name,
      order: row.order,
      widgets: row.widgets.map(widgetRow),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async remove(id: string): Promise<void> {
    await db.dashboard.delete({ where: { id } });
  }
}

export class PrismaWidgetRepo implements WidgetRepoPort {
  async create(input: {
    dashboardId: string;
    type: WidgetType;
    title: string;
    config: string;
    layout: LayoutBox;
  }): Promise<Widget> {
    const row = await db.dashboardWidget.create({
      data: {
        dashboardId: input.dashboardId,
        type: input.type,
        title: input.title,
        config: input.config,
        layoutX: input.layout.x,
        layoutY: input.layout.y,
        layoutW: input.layout.w,
        layoutH: input.layout.h,
      },
    });
    return widgetRow(row);
  }

  async update(
    id: string,
    input: { title?: string; config?: string; layout?: LayoutBox },
  ): Promise<Widget> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.config !== undefined) data.config = input.config;
    if (input.layout !== undefined) {
      data.layoutX = input.layout.x;
      data.layoutY = input.layout.y;
      data.layoutW = input.layout.w;
      data.layoutH = input.layout.h;
    }
    const row = await db.dashboardWidget.update({
      where: { id },
      data,
    });
    return widgetRow(row);
  }

  async remove(id: string): Promise<void> {
    await db.dashboardWidget.delete({ where: { id } });
  }
}
