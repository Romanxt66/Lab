import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { env } from "@/shared/env";

/**
 * Prisma client singleton (Prisma 7 + better-sqlite3 driver adapter).
 *
 * A single instance is reused across hot-reloads in development to avoid
 * exhausting connections. This is shared infrastructure — the domain and
 * application layers never import it directly; only adapters do.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
