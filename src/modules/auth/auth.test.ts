import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/shared/session";
import { LoginUseCase } from "./application/login";
import type { UserRepoPort, User } from "@/modules/users/application/ports";

describe("session tokens", () => {
  it("round-trips a signed payload", async () => {
    const token = await createSessionToken({
      uid: "u1",
      email: "a@b.com",
      name: "Ana",
      role: "superadmin",
    });
    const payload = await verifySessionToken(token);
    expect(payload?.uid).toBe("u1");
    expect(payload?.role).toBe("superadmin");
    expect(payload?.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken({
      uid: "u1",
      email: "a@b.com",
      name: null,
      role: "user",
    });
    const [body] = token.split(".");
    expect(await verifySessionToken(`${body}.deadbeef`)).toBeNull();
    expect(await verifySessionToken("garbage")).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });
});

// Fake repo + fake verifier (plain === hash) — no DB, no scrypt.
function repoWith(user: User | null): UserRepoPort {
  return {
    async findByEmail(email) {
      return user && user.email === email ? user : null;
    },
    async upsertByEmail() {
      throw new Error("nope");
    },
    async count() {
      return user ? 1 : 0;
    },
  };
}

const admin: User = {
  id: "u1",
  email: "admin@lab.local",
  name: "Admin",
  passwordHash: "secret",
  role: "superadmin",
  createdAt: new Date(),
};

describe("LoginUseCase", () => {
  const verify = (plain: string, hash: string) => plain === hash;

  it("authenticates with correct credentials", async () => {
    const res = await new LoginUseCase(repoWith(admin), verify).execute(
      "admin@lab.local",
      "secret",
    );
    expect(res.ok && res.value.role).toBe("superadmin");
  });

  it("rejects a wrong password", async () => {
    const res = await new LoginUseCase(repoWith(admin), verify).execute(
      "admin@lab.local",
      "nope",
    );
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown user with the same message", async () => {
    const res = await new LoginUseCase(repoWith(null), verify).execute(
      "ghost@lab.local",
      "secret",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Credenciales inválidas.");
  });
});
