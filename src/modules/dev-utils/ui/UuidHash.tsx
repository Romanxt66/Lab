"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  generateUuids,
  hashText,
  HASH_ALGOS,
  type HashAlgo,
} from "@/modules/dev-utils/domain/uuid-hash";
import { OutputBlock } from "./shared";

export function UuidHash() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <UuidPanel />
      <HashPanel />
    </div>
  );
}

function UuidPanel() {
  const [count, setCount] = React.useState(5);
  // Generate on mount, not during render: random values differ between the
  // server and client and would break hydration.
  const [uuids, setUuids] = React.useState<string[]>([]);

  React.useEffect(() => {
    setUuids(generateUuids(5));
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="uuid-count">Cantidad</Label>
          <Input
            id="uuid-count"
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-24"
          />
        </div>
        <Button onClick={() => setUuids(generateUuids(count))}>
          <RefreshCw />
          Generar UUID v4
        </Button>
      </div>
      <OutputBlock value={uuids.join("\n")} label="UUIDs" />
    </section>
  );
}

function HashPanel() {
  const [text, setText] = React.useState("");
  const [algo, setAlgo] = React.useState<HashAlgo>("SHA-256");
  const [digest, setDigest] = React.useState("");

  React.useEffect(() => {
    let active = true;
    if (!text) {
      setDigest("");
      return;
    }
    hashText(algo, text).then((res) => {
      if (active) setDigest(res.ok ? res.value : res.error);
    });
    return () => {
      active = false;
    };
  }, [text, algo]);

  return (
    <section className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="hash-input">Texto a hashear</Label>
        <Textarea
          id="hash-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe algo…"
          className="min-h-24"
          spellCheck={false}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {HASH_ALGOS.map((a) => (
          <button
            key={a}
            onClick={() => setAlgo(a)}
            className={
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
              (algo === a
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground")
            }
          >
            {a}
          </button>
        ))}
      </div>
      <OutputBlock value={digest} label={`${algo} (hex)`} />
    </section>
  );
}
