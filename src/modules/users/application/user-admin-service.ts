import { type Result, ok, err } from "@/shared/kernel/result";
import type { User, UserRepoPort, UserRole, UserStatus } from "./ports";

export interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  role: UserRole;
  status: UserStatus;
  /** Google-only accounts have no password. */
  authMethod: "google" | "password";
  createdAt: string;
  isSelf: boolean;
}

function toDTO(u: User, meId: string): UserDTO {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    picture: u.picture,
    role: u.role,
    status: u.status,
    authMethod: u.passwordHash ? "password" : "google",
    createdAt: u.createdAt.toISOString(),
    isSelf: u.id === meId,
  };
}

/**
 * Superadmin-only user management: approve/reject registrations, revoke
 * access, promote/demote. Every mutation guards against a superadmin
 * acting on their own account, so they can't accidentally lock themselves out.
 */
export class UserAdminService {
  constructor(private readonly users: UserRepoPort) {}

  async list(meId: string): Promise<UserDTO[]> {
    const rows = await this.users.list();
    return rows.map((u) => toDTO(u, meId));
  }

  /** Approves a pending or previously-rejected user. */
  async approve(id: string, meId: string): Promise<Result<UserDTO>> {
    const u = await this.users.updateStatus(id, "approved");
    return ok(toDTO(u, meId));
  }

  /** Rejects a pending signup, or revokes an already-approved user's access. */
  async reject(id: string, meId: string): Promise<Result<UserDTO>> {
    if (id === meId) return err("No puedes rechazar o revocar tu propia cuenta.");
    const u = await this.users.updateStatus(id, "rejected");
    return ok(toDTO(u, meId));
  }

  async setRole(id: string, role: UserRole, meId: string): Promise<Result<UserDTO>> {
    if (id === meId) return err("No puedes cambiar tu propio rol.");
    const u = await this.users.updateRole(id, role);
    return ok(toDTO(u, meId));
  }
}
