import "server-only";
import pg from "pg";
import { type Result, ok, err } from "@/shared/kernel/result";
import type { IntrospectionPort } from "@/modules/db-admin/application/ports";
import type {
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
} from "@/modules/db-admin/domain/schema-info";

const SYSTEM_SCHEMAS = new Set([
  "pg_catalog",
  "information_schema",
  "pg_toast",
]);

/** Reads structural metadata via information_schema / pg_catalog. */
export class PgIntrospection implements IntrospectionPort {
  async listSchemas(url: string): Promise<Result<SchemaInfo[]>> {
    return this.withClient(url, async (client) => {
      const res = await client.query<{ nspname: string }>(
        `SELECT nspname FROM pg_namespace
         WHERE nspname NOT LIKE 'pg_temp_%'
         ORDER BY nspname`,
      );
      return ok(
        res.rows.map((r) => ({
          name: r.nspname,
          isSystem: SYSTEM_SCHEMAS.has(r.nspname) || r.nspname.startsWith("pg_"),
        })),
      );
    });
  }

  async listTables(url: string, schema: string): Promise<Result<TableInfo[]>> {
    return this.withClient(url, async (client) => {
      // pg_class.relkind: r=table, v=view, m=matview, f=foreign, p=partitioned.
      const res = await client.query<{
        relname: string;
        relkind: string;
        reltuples: string;
      }>(
        `SELECT c.relname, c.relkind, c.reltuples::text
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relkind IN ('r','v','m','p','f')
          ORDER BY c.relname`,
        [schema],
      );
      return ok(
        res.rows.map((r) => ({
          schema,
          name: r.relname,
          kind: kindLabel(r.relkind),
          rowsApprox: Math.max(0, Math.round(Number(r.reltuples))),
        })),
      );
    });
  }

  async listColumns(
    url: string,
    schema: string,
    table: string,
  ): Promise<Result<ColumnInfo[]>> {
    return this.withClient(url, async (client) => {
      const res = await client.query<{
        column_name: string;
        data_type: string;
        is_nullable: "YES" | "NO";
        column_default: string | null;
        ordinal_position: number;
        is_primary: boolean;
      }>(
        `SELECT c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.ordinal_position,
                COALESCE(pk.is_primary, false) AS is_primary
           FROM information_schema.columns c
           LEFT JOIN (
             SELECT kcu.column_name, true AS is_primary
               FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage kcu
                 ON kcu.constraint_name = tc.constraint_name
                AND kcu.table_schema = tc.table_schema
                AND kcu.table_name = tc.table_name
              WHERE tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_schema = $1
                AND tc.table_name = $2
           ) pk ON pk.column_name = c.column_name
          WHERE c.table_schema = $1 AND c.table_name = $2
          ORDER BY c.ordinal_position`,
        [schema, table],
      );
      return ok(
        res.rows.map((r) => ({
          name: r.column_name,
          dataType: r.data_type,
          isNullable: r.is_nullable === "YES",
          isPrimaryKey: r.is_primary,
          default: r.column_default,
          ordinalPosition: r.ordinal_position,
        })),
      );
    });
  }

  /**
   * All FK constraints in a schema. `conkey`/`confkey` are column-number
   * arrays, unnested with ordinality so composite keys keep their pairing.
   */
  async listForeignKeys(url: string, schema: string): Promise<Result<ForeignKeyInfo[]>> {
    return this.withClient(url, async (client) => {
      const res = await client.query<{
        constraint_name: string;
        table_schema: string;
        table_name: string;
        columns: string[];
        ref_schema: string;
        ref_table: string;
        ref_columns: string[];
      }>(
        `SELECT con.conname                AS constraint_name,
                nsp.nspname                AS table_schema,
                rel.relname                AS table_name,
                ARRAY(
                  SELECT att.attname
                    FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
                    JOIN pg_attribute att
                      ON att.attrelid = con.conrelid AND att.attnum = k.attnum
                   ORDER BY k.ord
                )                          AS columns,
                fnsp.nspname               AS ref_schema,
                frel.relname               AS ref_table,
                ARRAY(
                  SELECT fatt.attname
                    FROM unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord)
                    JOIN pg_attribute fatt
                      ON fatt.attrelid = con.confrelid AND fatt.attnum = fk.attnum
                   ORDER BY fk.ord
                )                          AS ref_columns
           FROM pg_constraint con
           JOIN pg_class rel      ON rel.oid = con.conrelid
           JOIN pg_namespace nsp  ON nsp.oid = rel.relnamespace
           JOIN pg_class frel     ON frel.oid = con.confrelid
           JOIN pg_namespace fnsp ON fnsp.oid = frel.relnamespace
          WHERE con.contype = 'f' AND nsp.nspname = $1
          ORDER BY rel.relname, con.conname`,
        [schema],
      );
      return ok(
        res.rows.map((r) => ({
          constraintName: r.constraint_name,
          schema: r.table_schema,
          table: r.table_name,
          columns: r.columns ?? [],
          refSchema: r.ref_schema,
          refTable: r.ref_table,
          refColumns: r.ref_columns ?? [],
        })),
      );
    });
  }

  async listIndexes(url: string, schema: string, table: string): Promise<Result<IndexInfo[]>> {
    return this.withClient(url, async (client) => {
      const res = await client.query<{
        indexname: string;
        indexdef: string;
        is_unique: boolean;
        is_primary: boolean;
      }>(
        `SELECT i.relname AS indexname,
                pg_get_indexdef(i.oid) AS indexdef,
                idx.indisunique  AS is_unique,
                idx.indisprimary AS is_primary
           FROM pg_index idx
           JOIN pg_class i   ON i.oid = idx.indexrelid
           JOIN pg_class t   ON t.oid = idx.indrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = $1 AND t.relname = $2
          ORDER BY idx.indisprimary DESC, i.relname`,
        [schema, table],
      );
      return ok(
        res.rows.map((r) => ({
          name: r.indexname,
          definition: r.indexdef,
          isUnique: r.is_unique,
          isPrimary: r.is_primary,
        })),
      );
    });
  }

  private async withClient<T>(
    url: string,
    fn: (client: pg.Client) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    let client: pg.Client | null = null;
    try {
      client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 8_000 });
      await client.connect();
      return await fn(client);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return err(msg);
    } finally {
      if (client) await client.end().catch(() => {});
    }
  }
}

function kindLabel(k: string): string {
  switch (k) {
    case "r": return "BASE TABLE";
    case "v": return "VIEW";
    case "m": return "MATERIALIZED VIEW";
    case "p": return "PARTITIONED TABLE";
    case "f": return "FOREIGN TABLE";
    default: return k;
  }
}
