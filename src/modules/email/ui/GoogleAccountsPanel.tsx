"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listGoogleAccountsAction,
  disconnectGoogleAccountAction,
} from "@/modules/email/actions";
import type { GoogleAccountDTO } from "@/modules/email/domain/google-account";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

/**
 * Panel to connect / list / disconnect Google accounts used to send email.
 * The "Conectar cuenta" button starts the OAuth flow; Google shows its own
 * account picker (the familiar chooser with all logged-in accounts).
 */
export function GoogleAccountsPanel({ selectedId, onSelect }: Props) {
  const [accounts, setAccounts] = React.useState<GoogleAccountDTO[]>([]);
  const params = useSearchParams();
  const googleFlag = params.get("google");
  const emailFlag = params.get("email");
  const reason = params.get("reason");

  const refresh = React.useCallback(async () => {
    const list = await listGoogleAccountsAction();
    setAccounts(list);
    // Auto-select a freshly-connected account, or the first one available.
    if (!selectedId) {
      const target = list.find((a) => a.email === emailFlag) ?? list[0];
      if (target) onSelect(target.id);
    }
  }, [selectedId, onSelect, emailFlag]);

  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDisconnect(id: string) {
    await disconnectGoogleAccountAction(id);
    if (selectedId === id) onSelect("");
    await refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Cuentas de Google</h3>
        <a href="/api/auth/google/start">
          <Button size="sm" variant="outline" type="button">
            <Plus />
            Conectar cuenta
          </Button>
        </a>
      </div>

      {googleFlag === "ok" && emailFlag ? (
        <p className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          <CheckCircle2 className="size-3.5" />
          Cuenta conectada: {emailFlag}
        </p>
      ) : null}
      {googleFlag === "error" ? (
        <p className="flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertCircle className="size-3.5" />
          No se pudo conectar la cuenta{reason ? ` (${reason})` : ""}.
        </p>
      ) : null}

      {accounts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Aún no has conectado ninguna cuenta.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {accounts.map((account) => {
            const active = account.id === selectedId;
            return (
              <li key={account.id}>
                <div
                  className={
                    "flex items-center gap-2.5 rounded-md border p-2 transition-colors " +
                    (active
                      ? "border-foreground/40 bg-foreground/[0.06]"
                      : "border-border hover:bg-foreground/[0.03]")
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSelect(account.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {account.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={account.picture}
                        alt=""
                        className="size-7 shrink-0 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-semibold uppercase">
                        {account.email.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0">
                      {account.name ? (
                        <p className="truncate text-sm font-medium">
                          {account.name}
                        </p>
                      ) : null}
                      <p className="truncate text-xs text-muted-foreground">
                        {account.email}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Desconectar"
                    onClick={() => onDisconnect(account.id)}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Al conectar, Google mostrará el selector con las cuentas en las que ya
        estás autenticado en este navegador. Después podrás elegir aquí desde
        cuál enviar.
      </p>
    </div>
  );
}
