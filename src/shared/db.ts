import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/shared/env";

/**
 * Prisma client singleton (Prisma 7 + node-postgres driver adapter).
 *
 * A single instance is reused across hot-reloads in development to avoid
 * exhausting connections. Shared infrastructure — only adapters import it.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/** Read the `?schema=` param from the URL so all queries hit the Lab's own
 * PostgreSQL schema (isolated from other projects living in `public`). */
function schemaFromUrl(url: string): string {
  try {
    return new URL(url).searchParams.get("schema") || "public";
  } catch {
    return "public";
  }
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg(
    { connectionString: env.DATABASE_URL },
    { schema: schemaFromUrl(env.DATABASE_URL) },
  );
  return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
