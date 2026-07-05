// Safety + setup before `prisma db push`:
//  - Requires DATABASE_URL to target a DEDICATED schema (?schema=<name>, not
//    "public"), so Prisma can never manage/drop another project's tables.
//  - Creates that schema if it doesn't exist yet.
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[schema] DATABASE_URL no está definido. Abortando.");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error("[schema] DATABASE_URL no es una URL válida. Abortando.");
  process.exit(1);
}

const schema = parsed.searchParams.get("schema");
if (!schema || schema === "public") {
  console.error(
    "[schema] DATABASE_URL debe incluir ?schema=<nombre> distinto de 'public'\n" +
      "         (p. ej. ...?schema=lab) para NO tocar las tablas de otros\n" +
      "         proyectos en el esquema public. Abortando por seguridad.",
  );
  process.exit(1);
}

// node-postgres doesn't understand the ?schema param — strip it for the client.
parsed.searchParams.delete("schema");
const client = new pg.Client({ connectionString: parsed.toString() });

try {
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  console.log(`[schema] esquema "${schema}" listo.`);
} catch (e) {
  console.error("[schema] no se pudo crear el esquema:", e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
