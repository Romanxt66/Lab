"use client";

import * as React from "react";
import { Loader2, RefreshCw, Check, X, ShieldCheck, ShieldOff, Mail, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { cn } from "@/lib/utils";
import {
  listUsersAction,
  approveUserAction,
  rejectUserAction,
  setUserRoleAction,
} from "@/modules/users/actions";
import type { UserDTO } from "@/modules/users/application/user-admin-service";

const STATUS_LABEL: Record<UserDTO["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const STATUS_STYLE: Record<UserDTO["status"], string> = {
  pending: "bg-accent/15 text-accent",
  approved: "bg-success/15 text-success",
  rejected: "bg-danger/15 text-danger",
};

export function UserAdminTool() {
  const [users, setUsers] = React.useState<UserDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsersAction());
    } catch {
      setError("No se pudo cargar la lista de usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function withBusy(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyId(id);
    setError(null);
    const res = await fn();
    if (!res.ok) setError(res.error ?? "No se pudo completar la acción.");
    await refresh();
    setBusyId(null);
  }

  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Usuarios</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Aprueba solicitudes de registro y administra roles y accesos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {loading && users.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : (
        <>
          {pending.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-accent">
                Pendientes de aprobación ({pending.length})
              </h3>
              <div className="space-y-2">
                {pending.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    busy={busyId === u.id}
                    onApprove={() => withBusy(u.id, () => approveUserAction(u.id))}
                    onReject={() => withBusy(u.id, () => rejectUserAction(u.id))}
                    onSetRole={(role) => withBusy(u.id, () => setUserRoleAction(u.id, role))}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Todos los usuarios
            </h3>
            {others.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay más usuarios registrados.</p>
            ) : (
              <div className="space-y-2">
                {others.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    busy={busyId === u.id}
                    onApprove={() => withBusy(u.id, () => approveUserAction(u.id))}
                    onReject={() => withBusy(u.id, () => rejectUserAction(u.id))}
                    onSetRole={(role) => withBusy(u.id, () => setUserRoleAction(u.id, role))}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function UserRow({
  user,
  busy,
  onApprove,
  onReject,
  onSetRole,
}: {
  user: UserDTO;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSetRole: (role: "user" | "superadmin") => void;
}) {
  return (
    <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{user.name || user.email}</span>
          <span className={cn("rounded px-1.5 py-0.5 text-[0.65rem] font-medium", STATUS_STYLE[user.status])}>
            {STATUS_LABEL[user.status]}
          </span>
          {user.role === "superadmin" ? (
            <span className="flex items-center gap-1 rounded bg-accent/15 px-1.5 py-0.5 text-[0.65rem] font-medium text-accent">
              <ShieldCheck className="size-3" />
              Superadmin
            </span>
          ) : null}
          {user.isSelf ? (
            <span className="text-[0.65rem] text-muted-foreground">(tú)</span>
          ) : null}
        </div>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {user.authMethod === "google" ? <Globe className="size-3" /> : <Mail className="size-3" />}
          {user.email}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {user.status !== "approved" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onApprove}>
            {busy ? <Loader2 className="animate-spin" /> : <Check className="size-3.5" />}
            Aprobar
          </Button>
        ) : null}
        {!user.isSelf && user.status !== "rejected" ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onReject}>
            {busy ? <Loader2 className="animate-spin" /> : <X className="size-3.5" />}
            {user.status === "approved" ? "Revocar" : "Rechazar"}
          </Button>
        ) : null}
        {!user.isSelf && user.status === "approved" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onSetRole(user.role === "superadmin" ? "user" : "superadmin")}
            title={user.role === "superadmin" ? "Quitar superadmin" : "Ascender a superadmin"}
          >
            {user.role === "superadmin" ? (
              <ShieldOff className="size-3.5" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            {user.role === "superadmin" ? "Quitar admin" : "Ascender"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
