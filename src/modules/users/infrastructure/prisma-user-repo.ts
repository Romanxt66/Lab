import "server-only";
import { db } from "@/shared/db";
import type {
  UserRepoPort,
  User,
  UserRole,
  UserStatus,
} from "@/modules/users/application/ports";

type Row = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  passwordHash: string | null;
  role: string;
  status: string;
  createdAt: Date;
};

function toDomain(row: Row): User {
  return { ...row, role: row.role as UserRole, status: row.status as UserStatus };
}

/** UserRepoPort backed by Prisma (table `usuarioslab`). */
export class PrismaUserRepo implements UserRepoPort {
  async findByEmail(email: string): Promise<User | null> {
    const row = await db.usuariosLab.findUnique({ where: { email } });
    return row ? toDomain(row) : null;
  }

  async upsertByEmail(input: {
    email: string;
    name?: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    const row = await db.usuariosLab.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        name: input.name ?? null,
        passwordHash: input.passwordHash,
        role: input.role,
      },
      update: {
        name: input.name ?? null,
        passwordHash: input.passwordHash,
        role: input.role,
      },
    });
    return toDomain(row);
  }

  async register(input: {
    email: string;
    name?: string | null;
    picture?: string | null;
    passwordHash: string | null;
  }): Promise<User> {
    const row = await db.usuariosLab.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        picture: input.picture ?? null,
        passwordHash: input.passwordHash,
        role: "user",
        status: "pending",
      },
    });
    return toDomain(row);
  }

  async list(): Promise<User[]> {
    const rows = await db.usuariosLab.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toDomain);
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    const row = await db.usuariosLab.update({ where: { id }, data: { status } });
    return toDomain(row);
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    const row = await db.usuariosLab.update({ where: { id }, data: { role } });
    return toDomain(row);
  }

  count(): Promise<number> {
    return db.usuariosLab.count();
  }
}
