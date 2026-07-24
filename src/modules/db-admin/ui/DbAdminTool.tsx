"use client";

import * as React from "react";
import { ConnectionsPanel } from "./ConnectionsPanel";
import { SchemaExplorer } from "./SchemaExplorer";
import { QueryEditor } from "./QueryEditor";

/**
 * DB Admin — three-pane layout:
 *   left    connections (select / add / edit / delete / test)
 *   middle  schema tree of the active connection (schemas → tables → columns)
 *   right   SQL editor + result grid
 */
export function DbAdminTool() {
  const [connectionId, setConnectionId] = React.useState("");
  const [sql, setSql] = React.useState("");

  function insertSelect(schema: string, table: string) {
    const q = `SELECT * FROM "${schema}"."${table}" LIMIT 100;`;
    setSql(q);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_260px_1fr]">
      <aside className="glass rounded-lg border border-border/60 p-4">
        <ConnectionsPanel
          selectedId={connectionId}
          onSelect={setConnectionId}
        />
      </aside>

      <aside className="glass rounded-lg border border-border/60 p-4">
        <SchemaExplorer
          connectionId={connectionId}
          onPickTable={insertSelect}
        />
      </aside>

      <section className="glass rounded-lg border border-border/60 p-4">
        <QueryEditor
          connectionId={connectionId}
          initialSql={sql}
          onSqlChange={setSql}
        />
      </section>
    </div>
  );
}
