"use client";

import * as React from "react";
import { Loader2, Key, Link2, ArrowRight, ListTree, Fingerprint } from "lucide-react";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { tableDetailAction } from "@/modules/db-admin/actions";
import type { TableDetail } from "@/modules/db-admin/domain/schema-info";

/** Columns, indexes and both directions of foreign keys for one table. */
export function TableStructure({
  connectionId,
  schema,
  table,
}: {
  connectionId: string;
  schema: string;
  table: string;
}) {
  const [detail, setDetail] = React.useState<TableDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      const res = await tableDetailAction(connectionId, schema, table);
      if (res.ok) setDetail(res.value);
      else setError(res.error);
      setLoading(false);
    })();
  }, [connectionId, schema, table]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando estructura…
      </p>
    );
  }
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!detail) return null;

  return (
    <div className="space-y-5">
      <section>
        <SectionTitle icon={<ListTree className="size-3.5" />}>
          Columnas ({detail.columns.length})
        </SectionTitle>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-max text-xs">
            <thead className="border-b border-border/60 bg-foreground/[0.03] text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Columna</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Nulo</th>
                <th className="px-3 py-2 font-medium">Por defecto</th>
                <th className="px-3 py-2 font-medium">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {detail.columns.map((c) => (
                <tr key={c.name} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      {c.isPrimaryKey ? <Key className="size-3 text-accent" /> : null}
                      {c.references ? <Link2 className="size-3 text-muted-foreground" /> : null}
                      <span className="font-mono">{c.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{c.dataType}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {c.isNullable ? "sí" : "no"}
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-1.5 font-mono text-muted-foreground">
                    {c.default ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    {c.references
                      ? `${c.references.table}.${c.references.column}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle icon={<Fingerprint className="size-3.5" />}>
          Índices ({detail.indexes.length})
        </SectionTitle>
        {detail.indexes.length === 0 ? (
          <Empty>Sin índices.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {detail.indexes.map((idx) => (
              <li key={idx.name} className="rounded-lg border border-border/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{idx.name}</span>
                  {idx.isPrimary ? <Badge>PRIMARY</Badge> : null}
                  {idx.isUnique && !idx.isPrimary ? <Badge>UNIQUE</Badge> : null}
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {idx.definition}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle icon={<Link2 className="size-3.5" />}>Relaciones</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Apunta a
            </p>
            {detail.foreignKeys.length === 0 ? (
              <Empty>Ninguna.</Empty>
            ) : (
              <ul className="space-y-1">
                {detail.foreignKeys.map((fk) => (
                  <li
                    key={fk.constraintName}
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 font-mono text-[11px]"
                  >
                    <span>{fk.columns.join(", ")}</span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {fk.refTable}.{fk.refColumns.join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Referenciada por
            </p>
            {detail.referencedBy.length === 0 ? (
              <Empty>Ninguna.</Empty>
            ) : (
              <ul className="space-y-1">
                {detail.referencedBy.map((fk) => (
                  <li
                    key={fk.constraintName}
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 font-mono text-[11px]"
                  >
                    <span className="truncate">
                      {fk.table}.{fk.columns.join(", ")}
                    </span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <span>{fk.refColumns.join(", ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </h4>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
      {children}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}
