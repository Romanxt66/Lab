"use client";

import * as React from "react";
import { Globe, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/ui/copy-button";
import { ErrorNote, OutputBlock } from "@/modules/dev-utils/ui/shared";
import { scrapeAction } from "@/modules/scraper/actions";
import type { RunScrapeResult } from "@/modules/scraper/application/run-scrape";

export function ScraperTool() {
  const [url, setUrl] = React.useState("");
  const [selector, setSelector] = React.useState("");
  const [attribute, setAttribute] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<RunScrapeResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await scrapeAction({ url, selector, attribute });
      if (res.ok) setResult(res.value);
      else setError(res.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="url">URL</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="https://ejemplo.com"
                className="pl-8 font-mono"
              />
            </div>
            <Button onClick={run} disabled={loading || !url}>
              {loading ? <Loader2 className="animate-spin" /> : <Play />}
              Extraer
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="selector">
              Selector CSS{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Input
              id="selector"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="h2.title a"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attr">
              Atributo{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Input
              id="attr"
              value={attribute}
              onChange={(e) => setAttribute(e.target.value)}
              placeholder="href"
              className="font-mono"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Con selector devuelve el texto (o atributo) de cada coincidencia. Sin
          selector, muestra el cuerpo crudo (útil para APIs/JSON).
        </p>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {result ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              Estado:{" "}
              <span
                className={
                  result.status >= 200 && result.status < 300
                    ? "text-success"
                    : "text-danger"
                }
              >
                {result.status}
              </span>
            </span>
            {result.contentType ? (
              <span className="truncate font-mono text-xs">
                {result.contentType}
              </span>
            ) : null}
          </div>

          {result.items ? (
            <ResultsList items={result.items} />
          ) : (
            <OutputBlock value={result.raw ?? ""} label="Cuerpo (crudo)" />
          )}
        </div>
      ) : null}
    </div>
  );
}

function ResultsList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {items.length} resultado{items.length === 1 ? "" : "s"}
        </span>
        {items.length > 0 ? (
          <CopyButton value={items.join("\n")} label="Copiar todo" />
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          El selector no coincidió con ningún elemento.
        </p>
      ) : (
        <ol className="max-h-96 divide-y divide-border overflow-auto rounded-md border border-border">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 px-3 py-2 font-mono text-[13px] hover:bg-muted/30"
            >
              <span className="shrink-0 text-muted-foreground">{i + 1}</span>
              <span className="break-all">{item}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
