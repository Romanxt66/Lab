import { describe, it, expect } from "vitest";
import { DashboardService } from "./application/dashboard-service";
import type {
  DashboardRepoPort,
  WidgetRepoPort,
  WidgetDataProvider,
} from "./application/ports";
import type { Dashboard, Widget } from "./domain/dashboard";
import type { WidgetType, LayoutBox } from "./domain/widget-types";
import { parseWidgetConfig, DEFAULT_LAYOUT } from "./domain/widget-types";
import { ok, err, type Result } from "@/shared/kernel/result";

describe("parseWidgetConfig", () => {
  it("returns the parsed object for valid JSON", () => {
    expect(parseWidgetConfig('{"connectionId":"c1"}')).toEqual({
      connectionId: "c1",
    });
  });
  it("returns an empty object for garbage", () => {
    expect(parseWidgetConfig("not json")).toEqual({});
  });
  it("returns an empty object for JSON primitives", () => {
    expect(parseWidgetConfig("42")).toEqual({});
    expect(parseWidgetConfig("null")).toEqual({});
  });
});

// --- Fakes ---------------------------------------------------------------

class FakeDashboardRepo implements DashboardRepoPort {
  dashboards: Dashboard[] = [];
  async list() { return this.dashboards; }
  async get(id: string) { return this.dashboards.find((d) => d.id === id) ?? null; }
  async create(input: { name: string; order: number }): Promise<Dashboard> {
    const d: Dashboard = {
      id: `d${this.dashboards.length + 1}`,
      name: input.name,
      order: input.order,
      widgets: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.dashboards.push(d);
    return d;
  }
  async rename(id: string, name: string): Promise<Dashboard> {
    const d = this.dashboards.find((x) => x.id === id)!;
    d.name = name;
    return d;
  }
  async remove(id: string) {
    this.dashboards = this.dashboards.filter((d) => d.id !== id);
  }
}

class FakeWidgetRepo implements WidgetRepoPort {
  widgets: Widget[] = [];
  async create(input: {
    dashboardId: string;
    type: WidgetType;
    title: string;
    config: string;
    layout: LayoutBox;
  }): Promise<Widget> {
    const w: Widget = {
      id: `w${this.widgets.length + 1}`,
      dashboardId: input.dashboardId,
      type: input.type,
      title: input.title,
      config: input.config,
      layout: input.layout,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.widgets.push(w);
    return w;
  }
  async update(): Promise<Widget> { throw new Error("nope"); }
  async remove() {}
}

class FakeProvider implements WidgetDataProvider {
  calls = 0;
  async provide(): Promise<Result<{ hello: true }>> {
    this.calls++;
    return ok({ hello: true });
  }
}

describe("DashboardService", () => {
  it("creates a dashboard with the right order", async () => {
    const repo = new FakeDashboardRepo();
    const svc = new DashboardService(repo, new FakeWidgetRepo(), {});
    const a = await svc.createDashboard("A");
    const b = await svc.createDashboard("B");
    expect(a.ok && a.value.order).toBe(0);
    expect(b.ok && b.value.order).toBe(1);
  });

  it("rejects empty dashboard names", async () => {
    const svc = new DashboardService(
      new FakeDashboardRepo(),
      new FakeWidgetRepo(),
      {},
    );
    expect((await svc.createDashboard("   ")).ok).toBe(false);
    expect((await svc.renameDashboard("x", " ")).ok).toBe(false);
  });

  it("adds a widget with the default layout for its type", async () => {
    const wRepo = new FakeWidgetRepo();
    const svc = new DashboardService(
      new FakeDashboardRepo(),
      wRepo,
      {},
    );
    const res = await svc.addWidget({
      dashboardId: "d1",
      type: "lab-recent-jobs",
      title: "Últimos jobs",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.layout).toEqual(DEFAULT_LAYOUT["lab-recent-jobs"]);
    }
  });

  it("dispatches loadWidgetData to the matching provider", async () => {
    const provider = new FakeProvider();
    const svc = new DashboardService(
      new FakeDashboardRepo(),
      new FakeWidgetRepo(),
      { "lab-recent-jobs": provider },
    );
    const widget: Widget = {
      id: "w1",
      dashboardId: "d1",
      type: "lab-recent-jobs",
      title: "x",
      config: "{}",
      layout: DEFAULT_LAYOUT["lab-recent-jobs"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const r = await svc.loadWidgetData(widget);
    expect(r.ok).toBe(true);
    expect(provider.calls).toBe(1);
  });

  it("returns an error for widget types with no provider", async () => {
    const svc = new DashboardService(
      new FakeDashboardRepo(),
      new FakeWidgetRepo(),
      {},
    );
    const widget: Widget = {
      id: "w1",
      dashboardId: "d1",
      type: "sql-metric",
      title: "x",
      config: "{}",
      layout: DEFAULT_LAYOUT["sql-metric"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const r = await svc.loadWidgetData(widget);
    expect(r.ok).toBe(false);
  });
});

// Guard against unused imports
void err;
