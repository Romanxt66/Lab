import { describe, it, expect } from "vitest";
import { UserAdminService } from "./application/user-admin-service";
import type { User, UserRepoPort, UserRole, UserStatus } from "./application/ports";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    email: "ana@lab.local",
    name: "Ana",
    picture: null,
    passwordHash: "hash",
    role: "user",
    status: "pending",
    createdAt: new Date(),
    ...overrides,
  };
}

class FakeUserRepo implements UserRepoPort {
  constructor(public users: User[]) {}
  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }
  async upsertByEmail(): Promise<User> {
    throw new Error("nope");
  }
  async register(): Promise<User> {
    throw new Error("nope");
  }
  async list() {
    return this.users;
  }
  async updateStatus(id: string, status: UserStatus): Promise<User> {
    const u = this.users.find((x) => x.id === id);
    if (!u) throw new Error("not found");
    u.status = status;
    return u;
  }
  async updateRole(id: string, role: UserRole): Promise<User> {
    const u = this.users.find((x) => x.id === id);
    if (!u) throw new Error("not found");
    u.role = role;
    return u;
  }
  async count() {
    return this.users.length;
  }
}

describe("UserAdminService", () => {
  it("approves a pending user", async () => {
    const repo = new FakeUserRepo([makeUser({ status: "pending" })]);
    const svc = new UserAdminService(repo);
    const res = await svc.approve("u1", "admin1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.status).toBe("approved");
  });

  it("rejects (or revokes) a user", async () => {
    const repo = new FakeUserRepo([makeUser({ status: "approved" })]);
    const svc = new UserAdminService(repo);
    const res = await svc.reject("u1", "admin1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.status).toBe("rejected");
  });

  it("promotes a user to superadmin", async () => {
    const repo = new FakeUserRepo([makeUser({ role: "user" })]);
    const svc = new UserAdminService(repo);
    const res = await svc.setRole("u1", "superadmin", "admin1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.role).toBe("superadmin");
  });

  it("refuses to let a superadmin reject their own account", async () => {
    const repo = new FakeUserRepo([makeUser({ id: "admin1", status: "approved" })]);
    const svc = new UserAdminService(repo);
    const res = await svc.reject("admin1", "admin1");
    expect(res.ok).toBe(false);
    expect(repo.users[0].status).toBe("approved");
  });

  it("refuses to let a superadmin change their own role", async () => {
    const repo = new FakeUserRepo([makeUser({ id: "admin1", role: "superadmin" })]);
    const svc = new UserAdminService(repo);
    const res = await svc.setRole("admin1", "user", "admin1");
    expect(res.ok).toBe(false);
    expect(repo.users[0].role).toBe("superadmin");
  });

  it("flags the acting user's own row with isSelf", async () => {
    const repo = new FakeUserRepo([
      makeUser({ id: "admin1" }),
      makeUser({ id: "u2", email: "b@lab.local" }),
    ]);
    const svc = new UserAdminService(repo);
    const list = await svc.list("admin1");
    expect(list.find((u) => u.id === "admin1")?.isSelf).toBe(true);
    expect(list.find((u) => u.id === "u2")?.isSelf).toBe(false);
  });
});
