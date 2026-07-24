import "server-only";
import { db } from "@/shared/db";
import type { DbConnectionRepoPort } from "@/modules/db-admin/application/ports";
import type { DbConnection } from "@/modules/db-admin/domain/connection";

/** DbConnectionRepoPort backed by Prisma (table `lab_db_connection`). */
export class PrismaDbConnectionRepo implements DbConnectionRepoPort {
  list(): Promise<DbConnection[]> {
    return db.dbConnection.findMany({ orderBy: { createdAt: "asc" } });
  }
  get(id: string): Promise<DbConnection | null> {
    return db.dbConnection.findUnique({ where: { id } });
  }
  create(input: {
    name: string;
    connectionUrl: string;
    readOnly: boolean;
  }): Promise<DbConnection> {
    return db.dbConnection.create({ data: input });
  }
  update(
    id: string,
    input: { name: string; connectionUrl: string; readOnly: boolean },
  ): Promise<DbConnection> {
    return db.dbConnection.update({ where: { id }, data: input });
  }
  async remove(id: string): Promise<void> {
    await db.dbConnection.delete({ where: { id } });
  }
}
