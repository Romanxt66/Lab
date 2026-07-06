import "server-only";
import nodemailer from "nodemailer";
import { type Result, ok, err } from "@/shared/kernel/result";
import { assertGoogleOAuth } from "@/shared/env";
import { db } from "@/shared/db";
import { refreshAccessToken } from "@/modules/email/application/google-oauth";
import type { EmailMessage } from "@/modules/email/domain/email";
import type {
  AccountMailSenderPort,
  GoogleAccountRepoPort,
} from "@/modules/email/application/ports";

/**
 * AccountMailSenderPort backed by the Gmail REST API + OAuth2.
 *
 * Gmail's SMTP endpoint (XOAUTH2) rejects `gmail.send` scoped tokens with a
 * generic "535-5.7.8 Username and Password not accepted" — it wants the wider
 * `https://mail.google.com/` scope for SMTP. Sending via the REST API keeps
 * the scope minimal (`gmail.send`) and works reliably.
 *
 * Flow: build the raw RFC 5322 message with Nodemailer's stream transport,
 * base64url-encode it, POST to Gmail users.messages.send.
 */
export class GmailOAuthAdapter implements AccountMailSenderPort {
  constructor(private readonly accounts: GoogleAccountRepoPort) {}

  async sendFrom(
    accountId: string,
    msg: EmailMessage,
  ): Promise<Result<void>> {
    const account = await this.accounts.get(accountId);
    if (!account) return err("Cuenta de Google no encontrada.");
    if (!account.refreshToken) {
      return err(
        "La cuenta no tiene refresh_token. Desconéctala y vuelve a conectarla.",
      );
    }

    let cfg;
    try {
      cfg = assertGoogleOAuth();
    } catch (e) {
      return err(e instanceof Error ? e.message : "Google OAuth no configurado.");
    }

    // 1) Ensure a fresh access token (with a small safety margin).
    let accessToken = account.accessToken;
    const expiresAt = account.expiresAt;
    if (
      !accessToken ||
      !expiresAt ||
      expiresAt.getTime() - Date.now() < 60_000
    ) {
      try {
        const refreshed = await refreshAccessToken(
          {
            clientId: cfg.GOOGLE_CLIENT_ID,
            clientSecret: cfg.GOOGLE_CLIENT_SECRET,
            redirectUri: cfg.GOOGLE_REDIRECT_URI,
          },
          account.refreshToken,
        );
        accessToken = refreshed.accessToken;
        await db.googleAccount.update({
          where: { id: account.id },
          data: {
            accessToken: refreshed.accessToken,
            expiresAt: refreshed.expiresAt,
          },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[gmail-oauth] refresh failed:", message);
        if (/invalid_grant/i.test(message)) {
          return err(
            "La autorización expiró o fue revocada. Desconéctala y vuelve a conectarla.",
          );
        }
        return err(`No se pudo refrescar el token de Google: ${message}`);
      }
    }

    // 2) Build the raw RFC 5322 message (Nodemailer stream transport returns
    //    the built message without actually sending it).
    let rawMessage: Buffer;
    try {
      const transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: "unix",
        buffer: true,
      });
      const info = await transporter.sendMail({
        from: account.name
          ? `"${account.name}" <${account.email}>`
          : account.email,
        to: msg.to.join(", "),
        subject: msg.subject,
        text: msg.body,
        html: toHtml(msg.body),
      });
      rawMessage = info.message as Buffer;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[gmail-oauth] compose failed:", message);
      return err(`No se pudo construir el mensaje: ${message}`);
    }

    // 3) POST to Gmail users.messages.send.
    const raw = rawMessage
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ raw }),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          "[gmail-oauth] gmail api error:",
          res.status,
          detail,
        );
        if (res.status === 401) {
          return err(
            "Gmail rechazó el token (401). Desconecta la cuenta y vuélvela a conectar.",
          );
        }
        if (res.status === 403) {
          return err(
            "Gmail denegó el envío (403). Verifica que la Gmail API está habilitada y que la cuenta autorizó el permiso 'Send email on your behalf'.",
          );
        }
        return err(`Gmail rechazó el envío (${res.status}): ${detail}`);
      }
      return ok(undefined);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[gmail-oauth] send failed:", message);
      return err(`Gmail rechazó el envío: ${message}`);
    }
  }
}

/** Minimal text→HTML: preserve line breaks and escape entities. */
function toHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}
