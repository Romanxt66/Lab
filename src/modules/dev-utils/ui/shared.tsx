"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

/** Inline error note shown below inputs. */
export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-danger">
      <AlertCircle className="size-4 shrink-0" />
      {children}
    </p>
  );
}

/** A read-only, monospace output block with a copy affordance. */
export function OutputBlock({
  value,
  label = "Resultado",
  className,
  placeholder = "El resultado aparecerá aquí…",
}: {
  value: string;
  label?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {value ? <CopyButton value={value} /> : null}
      </div>
      <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[13px] leading-relaxed">
        {value || (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </pre>
    </div>
  );
}
