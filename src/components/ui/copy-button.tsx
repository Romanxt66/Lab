"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends ButtonProps {
  value: string;
  label?: string;
}

/** Copies `value` to the clipboard with a brief confirmation state. */
export function CopyButton({
  value,
  label,
  className,
  variant = "outline",
  size = "sm",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={copy}
      disabled={!value}
      className={cn(className)}
      {...props}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
      {label ?? (copied ? "Copiado" : "Copiar")}
    </Button>
  );
}
