"use server";

import { type Result } from "@/shared/kernel/result";
import { getUserAdminService } from "@/shared/di/container";
import { getCurrentUser } from "@/modules/auth/current-user";
import type { UserRole } from "@/modules/users/application/ports";
import type { UserDTO } from "@/modules/users/application/user-admin-service";

async function requireSuperadmin(): Promise<{ uid: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "superadmin") {
    throw new Error("No autorizado.");
  }
  return user;
}

export async function listUsersAction(): Promise<UserDTO[]> {
  const me = await requireSuperadmin();
  return getUserAdminService().list(me.uid);
}

export async function approveUserAction(id: string): Promise<Result<UserDTO>> {
  const me = await requireSuperadmin();
  return getUserAdminService().approve(id, me.uid);
}

export async function rejectUserAction(id: string): Promise<Result<UserDTO>> {
  const me = await requireSuperadmin();
  return getUserAdminService().reject(id, me.uid);
}

export async function setUserRoleAction(
  id: string,
  role: UserRole,
): Promise<Result<UserDTO>> {
  const me = await requireSuperadmin();
  return getUserAdminService().setRole(id, role, me.uid);
}
