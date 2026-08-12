import { describe, it, expect } from "vitest";
import { ok, type Result } from "@/shared/kernel/result";
import { GoogleLoginUseCase } from "./application/google-login";
import { RegisterUseCase } from "./application/register";
import type { User, UserRepoPort, UserRole, UserStatus } from "@/modules/users/application/ports";
import { SendNotification } from "@/modules/notifications/application/send-notification";
import type {
  NotificationConfigRepoPort,
  NotificationSenderPort,
} from "@/modules/notifications/application/ports";
import type { NotificationConfig } from "@/modules/notifications/domain/config";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    email: "ana@lab.local",
    name: "Ana",
    picture: null,
    passwordHash: "hash",
    role: "user",
    status: "approved",
    createdAt: new Date(),
    ...overrides,
  };
}

/** In-memory fake repo: findByEmail + register are what these use-cases need. */
class FakeUserRepo implements UserRepoPort {
  users: User[] = [];
  registered: { email: string; passwordHash: string | null }[] = [];
  constructor(seed: User[] = []) {
    this.users = seed;
  }
  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }
  async upsertByEmail(): Promise<User> {
    throw new Error("nope");
  }
  async register(input: {
    email: string;
    name?: string | null;
    picture?: string | null;
    passwordHash: string | null;
  }): Promise<User> {
    const u = makeUser({
      id: `u${this.users.length + 1}`,
      email: input.email,
      name: input.name ?? null,
      picture: input.picture ?? null,
      passwordHash: input.passwordHash,
      role: "user",
      status: "pending",
    });
    this.users.push(u);
    this.registered.push({ email: input.email, passwordHash: input.passwordHash });
    return u;
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

const notifConfig: NotificationConfig = {
  id: "c1",
  provider: "telegram",
  recipient: "123",
  credential: "k:AABBCC-Ddefghij_klmnop_qrstuvwxyz",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

class RecordingSender implements NotificationSenderPort {
  sent: string[] = [];
  async send(_p: string, _r: string, _c: string, m: string): Promise<Result<void>> {
    this.sent.push(m);
    return ok(undefined);
  }
}

class ConfigRepo implements NotificationConfigRepoPort {
  async list() {
    return [notifConfig];
  }
  async getActive() {
    return notifConfig;
  }
  async upsert(): Promise<NotificationConfig> {
    throw new Error("nope");
  }
  async remove() {}
}

function notifier(sender: NotificationSenderPort = new RecordingSender()) {
  return new SendNotification(sender, new ConfigRepo());
}

describe("GoogleLoginUseCase", () => {
  it("self-registers a brand-new email as pending and notifies", async () => {
    const repo = new FakeUserRepo();
    const sender = new RecordingSender();
    const res = await new GoogleLoginUseCase(repo, notifier(sender)).execute({
      email: "new@lab.local",
      name: "New Guy",
      picture: null,
    });
    // Linking succeeded; the account just isn't approved yet ("registered").
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual({ kind: "pending", isNew: true });
    expect(repo.registered).toHaveLength(1);
    expect(repo.registered[0].passwordHash).toBeNull();
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatch(/new@lab.local/);
  });

  it("logs in an existing approved account", async () => {
    const repo = new FakeUserRepo([makeUser({ status: "approved" })]);
    const res = await new GoogleLoginUseCase(repo, notifier()).execute({
      email: "ana@lab.local",
      name: "Ana",
      picture: null,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.kind === "session") {
      expect(res.value.user.email).toBe("ana@lab.local");
    } else {
      expect.fail("expected a session");
    }
  });

  it("returns pending (not new) for an existing unapproved account", async () => {
    const repo = new FakeUserRepo([makeUser({ status: "pending" })]);
    const sender = new RecordingSender();
    const res = await new GoogleLoginUseCase(repo, notifier(sender)).execute({
      email: "ana@lab.local",
      name: "Ana",
      picture: null,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual({ kind: "pending", isNew: false });
    // No duplicate registration and no repeat Telegram alert.
    expect(repo.registered).toHaveLength(0);
    expect(sender.sent).toHaveLength(0);
  });

  it("blocks a rejected account", async () => {
    const repo = new FakeUserRepo([makeUser({ status: "rejected" })]);
    const res = await new GoogleLoginUseCase(repo, notifier()).execute({
      email: "ana@lab.local",
      name: "Ana",
      picture: null,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.kind).toBe("rejected");
  });
});

describe("RegisterUseCase", () => {
  const hash = (plain: string) => `hashed:${plain}`;

  it("creates a pending account and notifies", async () => {
    const repo = new FakeUserRepo();
    const sender = new RecordingSender();
    const res = await new RegisterUseCase(repo, hash, notifier(sender)).execute({
      email: "nuevo@lab.local",
      name: "Nuevo",
      password: "supersecret",
    });
    expect(res.ok).toBe(true);
    expect(repo.registered[0].passwordHash).toBe("hashed:supersecret");
    expect(sender.sent).toHaveLength(1);
  });

  it("rejects a short password", async () => {
    const repo = new FakeUserRepo();
    const res = await new RegisterUseCase(repo, hash, notifier()).execute({
      email: "nuevo@lab.local",
      name: "Nuevo",
      password: "short",
    });
    expect(res.ok).toBe(false);
    expect(repo.registered).toHaveLength(0);
  });

  it("rejects a duplicate email", async () => {
    const repo = new FakeUserRepo([makeUser({ email: "existe@lab.local" })]);
    const res = await new RegisterUseCase(repo, hash, notifier()).execute({
      email: "existe@lab.local",
      name: "Otra",
      password: "supersecret",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/ya existe/i);
  });
});
