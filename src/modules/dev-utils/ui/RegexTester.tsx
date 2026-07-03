"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { runRegex, type RegexOutcome } from "@/modules/dev-utils/domain/regex";
import { ErrorNote } from "./shared";

const FLAGS = ["g", "i", "m", "s", "u"] as const;

export function RegexTester() {
  const [pattern, setPattern] = React.useState("");
  const [flags, setFlags] = React.useState<Set<string>>(new Set(["g"]));
  const [text, setText] = React.useState("");
  const [outcome, setOutcome] = React.useState<RegexOutcome | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pattern) {
      setOutcome(null);
      setError(null);
      return;
    }
    const res = runRegex(pattern, [...flags].join(""), text);
    if (res.ok) {
      setOutcome(res.value);
      setError(null);
    } else {
      setOutcome(null);
      setError(res.error);
    }
  }, [pattern, flags, text]);

  function toggleFlag(f: string) {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-muted-foreground">/</span>
        <Input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="\d{3}-\d{4}"
          className="max-w-md font-mono"
          spellCheck={false}
        />
        <span className="font-mono text-muted-foreground">/</span>
        <div className="flex gap-1">
          {FLAGS.map((f) => (
            <button
              key={f}
              onClick={() => toggleFlag(f)}
              className={
                "size-8 rounded-md border font-mono text-sm transition-colors " +
                (flags.has(f)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
              title={`flag ${f}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Texto de prueba…"
        className="min-h-40"
        spellCheck={false}
      />

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {outcome ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {outcome.count === 0
              ? "Sin coincidencias."
              : `${outcome.count} coincidencia${outcome.count === 1 ? "" : "s"}.`}
          </p>
          {outcome.count > 0 ? (
            <div className="max-h-72 space-y-1.5 overflow-auto rounded-md border border-border p-3">
              {outcome.matches.slice(0, 200).map((m, i) => (
                <div key={i} className="font-mono text-[13px]">
                  <span className="mr-2 text-muted-foreground">
                    #{i + 1} @{m.index}
                  </span>
                  <span className="rounded bg-primary/15 px-1 text-primary">
                    {m.match || "∅"}
                  </span>
                  {m.groups.length > 0 ? (
                    <span className="ml-2 text-muted-foreground">
                      grupos: [{m.groups.join(", ")}]
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
