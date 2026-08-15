import { describe, it, expect } from "vitest";
import { ok, err, type Result } from "@/shared/kernel/result";
import { buildAssistantTools, type ToolContext, type ToolDeps } from "./application/tools";
import { UserAdminService } from "@/modules/users/application/user-admin-service";
import type { UserDTO } from "@/modules/users/application/user-admin-service";
import { CalendarService } from "@/modules/calendar/application/calendar-service";
import type { CalendarEvent, EventInput } from "@/modules/calendar/domain/event";
import { DbAdminService } from "@/modules/db-admin/application/db-admin-service";
import type { DbConnection } from "@/modules/db-admin/domain/connection";
import type { QueryResult } from "@/modules/db-admin/application/ports";

/**
 * Stub services: extend the real class (so TS's private-member nominal
 * typing is satisfied) and override only what the tools under test call.
 * `super(null as never, ...)` is safe because those deps are never touched.
 */
class StubUserAdmin extends UserAdminService {
  approved: string[] = [];
  rejected: string[] = [];
  constructor(private readonly fakeUsers: UserDTO[]) {
    super(null as never);
  }
  override async list(): Promise<UserDTO[]> {
    return this.fakeUsers;
  }
  override async approve(id: string, meId: string) {
    this.approved.push(id);
    return ok({ ...this.fakeUsers.find((u) => u.id === id)!, status: "approved" as const, isSelf: id === meId });
  }
  override async reject(id: string, meId: string) {
    if (id === meId) return err("No puedes rechazar o revocar tu propia cuenta.");
    this.rejected.push(id);
    return ok({ ...this.fakeUsers.find((u) => u.id === id)!, status: "rejected" as const, isSelf: false });
  }
}

class StubCalendar extends CalendarService {
  created: EventInput[] = [];
  constructor() {
    super(null as never);
  }
  override async create(input: EventInput) {
    this.created.push(input);
    return ok<CalendarEvent>({ ...input, id: "e1", createdAt: new Date() });
  }
}

class StubDbAdmin extends DbAdminService {
  queries: string[] = [];
  constructor(private readonly conns: DbConnection[]) {
    super(null as never, null as never, null as never);
  }
  override async list(): Promise<DbConnection[]> {
    return this.conns;
  }
  override async runQuery(id: string, sql: string): Promise<Result<QueryResult>> {
    this.queries.push(sql);
    return ok({
      columns: ["n"],
      columnTypes: ["int4"],
      rows: [[1]],
      rowCount: 1,
      durationMs: 2,
    });
  }
}

function makeConn(overrides: Partial<DbConnection> = {}): DbConnection {
  return {
    id: "c1",
    name: "Producción",
    connectionUrl: "postgresql://user:pass@host:5432/db",
    readOnly: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
  return {
    finance: null as never,
    uptime: null as never,
    users: new StubUserAdmin([]),
    calendar: new StubCalendar(),
    inventory: null as never,
    automations: null as never,
    dbAdmin: null as never,
    coolify: null as never,
    github: null as never,
    n8n: null as never,
    navigable: [
      { slug: "finance", name: "Finanzas", description: "" },
      { slug: "coolify", name: "Despliegues (Coolify)", description: "" },
    ],
    ...overrides,
  };
}

function makeUser(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
    id: "u2",
    email: "b@lab.local",
    name: "Beto",
    picture: null,
    role: "user",
    status: "pending",
    authMethod: "google",
    createdAt: new Date().toISOString(),
    isSelf: false,
    ...overrides,
  };
}

const regularUser: ToolContext = { uid: "u1", role: "user", effects: {} };
const superadmin: ToolContext = { uid: "admin1", role: "superadmin", effects: {} };

describe("assistant tools: user administration guard", () => {
  it("denies list_users to a non-superadmin", async () => {
    const users = new StubUserAdmin([makeUser()]);
    const tools = buildAssistantTools(makeDeps({ users }));
    const tool = tools.find((t) => t.name === "list_users")!;
    const result = await tool.execute({}, regularUser);
    expect(result).toMatch(/no autorizado/i);
  });

  it("lets a superadmin filter down to only pending users", async () => {
    const users = new StubUserAdmin([
      makeUser({ id: "u2", status: "pending" }),
      makeUser({ id: "u3", status: "approved" }),
    ]);
    const tools = buildAssistantTools(makeDeps({ users }));
    const tool = tools.find((t) => t.name === "list_users")!;
    const result = await tool.execute({ onlyPending: true }, superadmin);
    const parsed = JSON.parse(result) as { id: string }[];
    expect(parsed.map((u) => u.id)).toEqual(["u2"]);
  });

  it("denies approve_pending_user to a non-superadmin without calling the service", async () => {
    const users = new StubUserAdmin([makeUser()]);
    const tools = buildAssistantTools(makeDeps({ users }));
    const tool = tools.find((t) => t.name === "approve_pending_user")!;
    const result = await tool.execute({ id: "u2" }, regularUser);
    expect(result).toMatch(/no autorizado/i);
    expect(users.approved).toHaveLength(0);
  });

  it("lets a superadmin approve a pending user", async () => {
    const users = new StubUserAdmin([makeUser()]);
    const tools = buildAssistantTools(makeDeps({ users }));
    const tool = tools.find((t) => t.name === "approve_pending_user")!;
    const result = await tool.execute({ id: "u2" }, superadmin);
    expect(result).toMatch(/aprobado/i);
    expect(users.approved).toEqual(["u2"]);
  });

  it("surfaces the service's self-rejection guard as the tool result", async () => {
    const users = new StubUserAdmin([makeUser({ id: "admin1" })]);
    const tools = buildAssistantTools(makeDeps({ users }));
    const tool = tools.find((t) => t.name === "reject_pending_user")!;
    const result = await tool.execute({ id: "admin1" }, superadmin);
    expect(result).toMatch(/no puedes rechazar/i);
  });
});

describe("assistant tools: create_calendar_event", () => {
  it("rejects a malformed date without calling the calendar service", async () => {
    const calendar = new StubCalendar();
    const tools = buildAssistantTools(makeDeps({ calendar }));
    const tool = tools.find((t) => t.name === "create_calendar_event")!;
    const result = await tool.execute({ title: "Reunión", start: "no es una fecha" }, regularUser);
    expect(result).toMatch(/fecha no es válida/i);
    expect(calendar.created).toHaveLength(0);
  });

  it("creates an event with the given title and start", async () => {
    const calendar = new StubCalendar();
    const tools = buildAssistantTools(makeDeps({ calendar }));
    const tool = tools.find((t) => t.name === "create_calendar_event")!;
    const result = await tool.execute(
      { title: "Reunión", start: "2026-09-01T10:00:00.000Z" },
      regularUser,
    );
    expect(result).toMatch(/Reunión/);
    expect(calendar.created).toHaveLength(1);
    expect(calendar.created[0].title).toBe("Reunión");
    expect(calendar.created[0].allDay).toBe(false);
  });
});

describe("assistant tools: navigate_to_module", () => {
  it("records the requested slug as a client effect", async () => {
    const tools = buildAssistantTools(makeDeps());
    const tool = tools.find((t) => t.name === "navigate_to_module")!;
    const ctx: ToolContext = { uid: "u1", role: "user", effects: {} };
    const result = await tool.execute({ slug: "coolify" }, ctx);
    expect(ctx.effects.navigateTo).toBe("coolify");
    expect(result).toMatch(/Despliegues/);
  });

  it("rejects an unknown slug without setting an effect", async () => {
    const tools = buildAssistantTools(makeDeps());
    const tool = tools.find((t) => t.name === "navigate_to_module")!;
    const ctx: ToolContext = { uid: "u1", role: "user", effects: {} };
    const result = await tool.execute({ slug: "no-existe" }, ctx);
    expect(ctx.effects.navigateTo).toBeUndefined();
    expect(result).toMatch(/no existe/i);
  });

  it("lists the available slugs in its description so the model can pick one", () => {
    const tools = buildAssistantTools(makeDeps());
    const tool = tools.find((t) => t.name === "navigate_to_module")!;
    expect(tool.description).toContain("coolify");
    expect(tool.description).toContain("finance");
  });
});

describe("assistant tools: database admin", () => {
  it("reports how many connections are configured", async () => {
    const dbAdmin = new StubDbAdmin([
      makeConn({ id: "c1", name: "Producción" }),
      makeConn({ id: "c2", name: "Local", readOnly: false }),
    ]);
    const tools = buildAssistantTools(makeDeps({ dbAdmin }));
    const tool = tools.find((t) => t.name === "list_database_connections")!;
    const parsed = JSON.parse(await tool.execute({}, regularUser)) as {
      total: number;
      conexiones: { nombre: string }[];
    };
    expect(parsed.total).toBe(2);
    expect(parsed.conexiones.map((c) => c.nombre)).toEqual(["Producción", "Local"]);
  });

  it("never exposes the connection URL (it holds credentials)", async () => {
    const dbAdmin = new StubDbAdmin([makeConn()]);
    const tools = buildAssistantTools(makeDeps({ dbAdmin }));
    const tool = tools.find((t) => t.name === "list_database_connections")!;
    const raw = await tool.execute({}, regularUser);
    expect(raw).not.toContain("postgresql://");
    expect(raw).not.toContain("pass");
  });

  it("runs a query through the service, which enforces its own SQL guards", async () => {
    const dbAdmin = new StubDbAdmin([makeConn()]);
    const tools = buildAssistantTools(makeDeps({ dbAdmin }));
    const tool = tools.find((t) => t.name === "run_database_query")!;
    await tool.execute({ connectionId: "c1", sql: "SELECT 1" }, regularUser);
    expect(dbAdmin.queries).toEqual(["SELECT 1"]);
  });

  it("surfaces the service's destructive-SQL refusal verbatim", async () => {
    class RefusingDbAdmin extends StubDbAdmin {
      override async runQuery() {
        return err("⚠️ Sentencia DROP. Confirma para ejecutar.");
      }
    }
    const tools = buildAssistantTools(makeDeps({ dbAdmin: new RefusingDbAdmin([makeConn()]) }));
    const tool = tools.find((t) => t.name === "run_database_query")!;
    const result = await tool.execute({ connectionId: "c1", sql: "DROP TABLE x" }, regularUser);
    expect(result).toMatch(/Confirma para ejecutar/);
  });
});
