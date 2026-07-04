import "server-only";
import { db } from "@/shared/db";
import type {
  UserRepoPort,
  User,
  UserRole,
} from "@/modules/users/application/ports";

type Row = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  role: string;
  createdAt: Date;
};

function toDomain(row: Row): User {
  return { ...row, role: row.role as UserRole };
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

  count(): Promise<number> {
    return db.usuariosLab.count();
  }
}
