"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { loginAction } from "@/modules/auth/actions";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginAction({ email, password });
      if (res.ok) {
        router.replace("/");
        router.refresh();
      } else {
        setError(res.error);
        setLoading(false);
      }
    } catch {
      setError("No se pudo conectar. ¿Está la base de datos accesible?");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <FlaskConical className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Lab</h1>
          <p className="text-sm text-muted-foreground">
            Inicia sesión para continuar
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="glass space-y-4 rounded-xl border border-border/60 p-6 shadow-sm"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@lab.local"
            autoFocus
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
          {loading ? "Entrando…" : "Iniciar sesión"}
        </Button>
      </form>
    </div>
  );
}
