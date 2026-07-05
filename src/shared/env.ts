import "server-only";
import { z } from "zod";

/**
 * Centralised, validated access to environment variables (server-side only).
 *
 * Most vars are optional so the lab boots with zero config for the pure-domain
 * tools (dev-utils). Each adapter validates the specific vars it needs at the
 * point of use and returns a friendly error if they're missing — see
 * `assertSmtp()` / `assertCronSecret()`.
 */
const schema = z.object({
  // Persistence (Prisma / PostgreSQL connection string). Strip accidental
  // surrounding quotes/whitespace so a pasted value stays valid.
  DATABASE_URL: z
    .string()
    .default("")
    .transform((v) => v.trim().replace(/^["']|["']$/g, "")),

  // Session signing secret for auth (HMAC). A dev fallback keeps things running
  // locally; ALWAYS set a strong value in production.
  SESSION_SECRET: z
    .string()
    .min(1)
    .default("dev-insecure-session-secret-change-me"),

  // SMTP (email module). Optional until the email tool is configured.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Scheduler: shared secret protecting the cron HTTP trigger in prod.
  CRON_SECRET: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    z.treeifyError(parsed.error),
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

/** Throws a friendly error if SMTP is not fully configured. */
export function assertSmtp() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error(
      "SMTP no está configurado. Define SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y SMTP_FROM en .env.local",
    );
  }
  return { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM };
}
