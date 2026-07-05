// Safety + setup before `prisma db push`:
//  - Requires DATABASE_URL to target a DEDICATED schema (?schema=<name>, not
//    "public"), so Prisma can never manage/drop another project's tables.
//  - Creates that schema if it doesn't exist yet.
import pg from "pg";

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
} catch (e) {
  console.error("[schema] no se pudo preparar el esquema:", e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
