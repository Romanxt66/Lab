"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, LogIn, Clock3, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { loginAction } from "@/modules/auth/actions";
import { GoogleButton } from "./GoogleButton";

export function LoginForm({
  initialError,
  status,
  statusEmail,
}: {
  initialError?: string | null;
  /** Outcome of a Google sign-in round-trip: registered | pending | rejected. */
  status?: string | null;
  statusEmail?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(initialError ?? null);
  const [loading, setLoading] = React.useState(false);

  // A rejected account is a hard stop; show it in the error slot instead.
  const rejected = status === "rejected";
  const awaiting = status === "registered" || status === "pending";
  const displayError = rejected
    ? "Tu acceso fue rechazado. Contacta al administrador."
    : error;

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

      {awaiting ? (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            {status === "registered" ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            ) : (
              <Clock3 className="size-4 shrink-0 text-accent" />
            )}
            En espera de aprobación
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {status === "registered"
              ? "Vinculamos tu cuenta de Google correctamente. Un administrador debe aprobar tu acceso antes de que puedas entrar."
              : "Tu cuenta aún no ha sido aprobada por el administrador."}
          </p>
          {statusEmail ? (
            <p className="mt-1.5 truncate text-xs text-muted-foreground">{statusEmail}</p>
          ) : null}
        </div>
      ) : null}

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

        {displayError ? <ErrorNote>{displayError}</ErrorNote> : null}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
          {loading ? "Entrando…" : "Iniciar sesión"}
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          o
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleButton />

        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Regístrate
          </Link>
        </p>
      </form>
    </div>
  );
}
