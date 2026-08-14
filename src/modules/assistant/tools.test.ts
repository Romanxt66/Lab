import { describe, it, expect } from "vitest";
import { ok, err } from "@/shared/kernel/result";
import { buildAssistantTools, type ToolContext, type ToolDeps } from "./application/tools";
import { UserAdminService } from "@/modules/users/application/user-admin-service";
import type { UserDTO } from "@/modules/users/application/user-admin-service";
import { CalendarService } from "@/modules/calendar/application/calendar-service";
import type { CalendarEvent, EventInput } from "@/modules/calendar/domain/event";

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

function makeDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
  return {
    finance: null as never,
    uptime: null as never,
    users: new StubUserAdmin([]),
    calendar: new StubCalendar(),
    inventory: null as never,
    automations: null as never,
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

const regularUser: ToolContext = { uid: "u1", role: "user" };
const superadmin: ToolContext = { uid: "admin1", role: "superadmin" };

describe("assistant tools: user administration guard", () => {
  it("denies list_pending_users to a non-superadmin", async () => {
    const users = new StubUserAdmin([makeUser()]);
    const tools = buildAssistantTools(makeDeps({ users }));
    const tool = tools.find((t) => t.name === "list_pending_users")!;
    const result = await tool.execute({}, regularUser);
    expect(result).toMatch(/no autorizado/i);
  });

  it("lets a superadmin list only pending users", async () => {
    const users = new StubUserAdmin([
      makeUser({ id: "u2", status: "pending" }),
      makeUser({ id: "u3", status: "approved" }),
    ]);
    const tools = buildAssistantTools(makeDeps({ users }));
    const tool = tools.find((t) => t.name === "list_pending_users")!;
    const result = await tool.execute({}, superadmin);
    const parsed = JSON.parse(result) as { id: string }[];
    expect(parsed).toEqual([{ id: "u2", nombre: "Beto", email: "b@lab.local" }]);
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
