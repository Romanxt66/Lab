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

export function TimestampTool() {
  const [input, setInput] = React.useState("");
  // Start null and fill on mount: computing "now" during SSR would mismatch
  // the client on hydration.
  const [data, setData] = React.useState<TimeBreakdown | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!input.trim()) setData(nowBreakdown());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!input.trim()) {
      setError(null);
      return;
    }
    const res = parseTime(input);
    if (res.ok) {
      setData(res.value);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [input]);

  function useNow() {
    const now = nowBreakdown();
    setData(now);
    setInput("");
    setError(null);
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
