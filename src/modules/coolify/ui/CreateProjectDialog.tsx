"use client";

import * as React from "react";
import { Loader2, X, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCoolifyProjectAction } from "@/modules/coolify/actions";

export function CreateProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function create() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    const res = await createCoolifyProjectAction({ name, description });
    setSaving(false);
    if (res.ok) {
      setOkMsg(res.value);
      await onCreated();
    } else {
      setError(res.error);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-sm rounded-xl border border-border/60 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="accent-grad flex size-8 items-center justify-center rounded-lg text-white">
              <FolderPlus className="size-4" />
            </span>
            <h3 className="font-medium">Nuevo proyecto</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Nombre</Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mi-proyecto"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Descripción (opcional)</Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-14 font-sans"
            />
          </div>

          {error ? (
            <p className="rounded-md bg-danger/10 p-2 text-sm text-danger">{error}</p>
          ) : null}
          {okMsg ? (
            <p className="rounded-md bg-success/10 p-2 text-sm text-success">{okMsg}</p>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={create} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : <FolderPlus className="size-3.5" />}
              Crear
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {okMsg ? "Cerrar" : "Cancelar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
