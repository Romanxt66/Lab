"use client";

import * as React from "react";
import { Clock, ShieldAlert } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { decodeJwt, type DecodedJwt } from "@/modules/dev-utils/domain/jwt";
import { ErrorNote, OutputBlock } from "./shared";

export function JwtDecoder() {
  const [token, setToken] = React.useState("");

  // Decoding is a pure function of the token — derive it during render.
  const { decoded, error } = React.useMemo<{
    decoded: DecodedJwt | null;
    error: string | null;
  }>(() => {
    if (!token.trim()) return { decoded: null, error: null };
    const res = decodeJwt(token);
    return res.ok
      ? { decoded: res.value, error: null }
      : { decoded: null, error: res.error };
  }, [token]);

  return (
    <div className="space-y-4">
      <Textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Pega aquí tu JWT (eyJhbGci…)"
        className="min-h-28 break-all"
        spellCheck={false}
      />
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {decoded ? (
        <div className="space-y-4">
          {decoded.expiresAt ? (
            <div
              className={
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm " +
                (decoded.isExpired
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : "border-success/30 bg-success/10 text-success")
              }
            >
              {decoded.isExpired ? (
                <ShieldAlert className="size-4" />
              ) : (
                <Clock className="size-4" />
              )}
              {decoded.isExpired ? "Expirado" : "Válido"} · exp{" "}
              {decoded.expiresAt.toLocaleString()}
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <OutputBlock
              label="Header"
              value={JSON.stringify(decoded.header, null, 2)}
            />
            <OutputBlock
              label="Payload"
              value={JSON.stringify(decoded.payload, null, 2)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Nota: la firma no se verifica; esta herramienta solo decodifica para
            inspección.
          </p>
        </div>
      ) : null}
    </div>
  );
}
