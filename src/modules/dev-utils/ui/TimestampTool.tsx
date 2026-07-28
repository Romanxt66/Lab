"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  parseTime,
  nowBreakdown,
  type TimeBreakdown,
} from "@/modules/dev-utils/domain/timestamp";
import { ErrorNote } from "./shared";
import { useHydrated } from "@/lib/use-hydrated";

export function TimestampTool() {
  const [input, setInput] = React.useState("");
  // A manual "now" snapshot taken when the user clicks Ahora.
  const [nowSnapshot, setNowSnapshot] = React.useState<TimeBreakdown | null>(
    null,
  );
  // Computing "now" during SSR would mismatch the client on hydration, so we
  // hold a placeholder until hydrated.
  const hydrated = useHydrated();

  const { data, error } = React.useMemo<{
    data: TimeBreakdown | null;
    error: string | null;
  }>(() => {
    if (input.trim()) {
      const res = parseTime(input);
      return res.ok
        ? { data: res.value, error: null }
        : { data: null, error: res.error };
    }
    return {
      data: nowSnapshot ?? (hydrated ? nowBreakdown() : null),
      error: null,
    };
  }, [input, hydrated, nowSnapshot]);

  function useNow() {
    setInput("");
    setNowSnapshot(nowBreakdown());
  }

  const rows: [string, string][] = data
    ? [
        ["Unix (segundos)", String(data.unixSeconds)],
        ["Unix (ms)", String(data.unixMillis)],
        ["ISO 8601", data.iso],
        ["UTC", data.utc],
        ["Local", data.local],
        ["Relativo", data.relative],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Timestamp (unix) o fecha (ISO, etc.)"
          className="max-w-md font-mono"
          spellCheck={false}
        />
        <Button variant="outline" onClick={useNow}>
          <Clock />
          Ahora
        </Button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {data ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {rows.map(([label, value], i) => (
            <div
              key={label}
              className={
                "flex items-center justify-between gap-4 px-4 py-2.5 " +
                (i % 2 ? "bg-muted/30" : "")
              }
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-[13px]">{value}</code>
                <CopyButton value={value} size="icon" label="" variant="ghost" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
