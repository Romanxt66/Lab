// Safety + setup before `prisma db push`:
//  - Requires DATABASE_URL to target a DEDICATED schema (?schema=<name>, not
//    "public"), so Prisma can never manage/drop another project's tables.
//  - Creates that schema if it doesn't exist yet.
//  - Drops tables from removed features (see RETIRED_TABLES). `prisma db push`
//    (run without --accept-data-loss, on purpose) refuses to drop a non-empty
//    table, which would otherwise wedge the deploy forever. We drop these few
//    explicitly named, deliberately-removed tables ourselves — a targeted,
//    auditable list scoped to our own schema, never a blanket data-loss flag.
import pg from "pg";

// Tables that belonged to features we deleted. Each entry must correspond to a
// model that no longer exists in schema.prisma. IF EXISTS keeps this idempotent
// once the drop has already happened.
const RETIRED_TABLES = [
  "lab_dashboard_widget", // FK → lab_dashboard, so drop this first
  "lab_dashboard",
];

// Strip accidental surrounding quotes/whitespace (common when pasting into a
// hosting panel), then parse.
const url = (process.env.DATABASE_URL ?? "").trim().replace(/^["']|["']$/g, "");
if (!url) {
  console.error("[schema] DATABASE_URL no está definido. Abortando.");
  process.exit(1);
}

// Parse the schema param with a regex (postgres connection strings aren't
// always accepted by the WHATWG URL parser).
const match = url.match(/[?&]schema=([^&\s]+)/);
const schema = match ? decodeURIComponent(match[1]) : null;

if (!schema || schema === "public") {
  console.error(
    "[schema] DATABASE_URL debe incluir ?schema=<nombre> distinto de 'public'\n" +
      "         (p. ej. ...?schema=lab) para NO tocar las tablas de otros\n" +
      "         proyectos en el esquema public. Abortando por seguridad.",
  );
  process.exit(1);
}

// pg (node-postgres) ignores the unknown ?schema param, so pass the URL as-is.
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  console.log(`[schema] esquema "${schema}" listo.`);

  // Drop retired tables so `prisma db push` has nothing destructive to do.
  // Scoped to our dedicated schema; CASCADE clears dependent FKs/views.
  for (const table of RETIRED_TABLES) {
    await client.query(`DROP TABLE IF EXISTS "${schema}"."${table}" CASCADE`);
  }
  console.log(
    `[schema] tablas retiradas verificadas (${RETIRED_TABLES.join(", ")}).`,
  );
} catch (e) {
  console.error("[schema] no se pudo preparar el esquema:", e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
