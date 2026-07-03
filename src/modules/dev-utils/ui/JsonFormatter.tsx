"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatJson, minifyJson } from "@/modules/dev-utils/domain/json";
import { ErrorNote, OutputBlock } from "./shared";

export function JsonFormatter() {
  const [input, setInput] = React.useState("");
  const [output, setOutput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [indent, setIndent] = React.useState(2);

  function run(kind: "format" | "minify") {
    const res =
      kind === "format" ? formatJson(input, indent) : minifyJson(input);
    if (res.ok) {
      setOutput(res.value);
      setError(null);
    } else {
      setOutput("");
      setError(res.error);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='{"hola":"mundo"}'
          className="min-h-72"
          spellCheck={false}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => run("format")}>Formatear</Button>
          <Button variant="outline" onClick={() => run("minify")}>
            Minificar
          </Button>
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            Sangría
            <select
              value={indent}
              onChange={(e) => setIndent(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={0}>Tab 0</option>
            </select>
          </div>
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </div>
      <OutputBlock value={output} className="lg:pt-0" />
    </div>
  );
}
