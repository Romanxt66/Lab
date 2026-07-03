"use client";

import * as React from "react";
import { ArrowRightLeft } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { encodeBase64, decodeBase64 } from "@/modules/dev-utils/domain/base64";
import { ErrorNote, OutputBlock } from "./shared";

type Mode = "encode" | "decode";

export function Base64Tool() {
  const [mode, setMode] = React.useState<Mode>("encode");
  const [input, setInput] = React.useState("");
  const [output, setOutput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!input) {
      setOutput("");
      setError(null);
      return;
    }
    const res = mode === "encode" ? encodeBase64(input) : decodeBase64(input);
    if (res.ok) {
      setOutput(res.value);
      setError(null);
    } else {
      setOutput("");
      setError(res.error);
    }
  }, [input, mode]);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border border-border p-0.5">
        {(["encode", "decode"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              "rounded px-3 py-1 text-sm transition-colors " +
              (mode === m
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {m === "encode" ? "Texto → Base64" : "Base64 → Texto"}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "encode" ? "Texto a codificar" : "Base64 a decodificar"}
          className="min-h-48"
          spellCheck={false}
        />
        <div className="hidden self-center text-muted-foreground lg:block">
          <ArrowRightLeft className="size-5" />
        </div>
        <OutputBlock value={output} label="Salida" />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setInput("")}>
          Limpiar
        </Button>
      </div>
    </div>
  );
}
