"use client";

import * as React from "react";
import Link from "next/link";
import { FlaskConical, Loader2, UserPlus, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { registerAction } from "@/modules/auth/actions";
import { GoogleButton } from "./GoogleButton";

export function RegisterForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await registerAction({ email, name, password });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(res.error);
        setLoading(false);
      }
    } catch {
      setError("No se pudo conectar. ¿Está la base de datos accesible?");
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-sm">
        <div className="glass space-y-3 rounded-xl border border-border/60 p-6 text-center shadow-sm">
          <MailCheck className="mx-auto size-8 text-success" />
          <h1 className="text-lg font-semibold tracking-tight">Solicitud enviada</h1>
          <p className="text-sm text-muted-foreground">
            Un administrador debe aprobar tu cuenta antes de que puedas entrar. Te
            avisaremos cuando esté lista.
          </p>
          <Link href="/login" className="inline-block text-sm font-medium hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    );
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
            Crea una cuenta — necesita aprobación
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="glass space-y-4 rounded-xl border border-border/60 p-6 shadow-sm"
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            autoFocus
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@dominio.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
          />
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Loader2 className="animate-spin" /> : <UserPlus />}
          {loading ? "Enviando…" : "Solicitar acceso"}
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          o
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleButton />

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  );
}
