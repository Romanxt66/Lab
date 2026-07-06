import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
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
 * AccountMailSenderPort backed by Nodemailer + XOAUTH2 against Gmail SMTP.
 *
 * We refresh the access token ourselves (rather than letting Nodemailer do it)
 * so we can persist the fresh token/expiry, and never pass a stale token that
 * would make Gmail reject the SMTP auth with "535-5.7.8 Username and Password
 * not accepted".
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
        "La cuenta no tiene refresh_token. Vuelve a conectarla desde el panel.",
      );
    }

    let cfg;
    try {
      cfg = assertGoogleOAuth();
    } catch (e) {
      return err(e instanceof Error ? e.message : "Google OAuth no configurado.");
    }

    // Ensure a fresh access token before hitting Gmail. Refresh with a small
    // safety margin so we don't send with a token that's about to expire.
    let accessToken = account.accessToken;
    const expiresAt = account.expiresAt;
    const marginMs = 60_000;
    if (
      !accessToken ||
      !expiresAt ||
      expiresAt.getTime() - Date.now() < marginMs
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
        // Persist so the next send reuses the same token until it expires.
        await db.googleAccount.update({
          where: { id: account.id },
          data: {
            accessToken: refreshed.accessToken,
            expiresAt: refreshed.expiresAt,
          },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (/invalid_grant/i.test(message)) {
          return err(
            "La autorización de esta cuenta ha expirado o fue revocada. Vuelve a conectarla desde el panel.",
          );
        }
        return err(`No se pudo refrescar el token de Google: ${message}`);
      }
    }

    try {
      const transporter: Transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          type: "OAuth2",
          user: account.email,
          accessToken: accessToken!,
        },
      });

      await transporter.sendMail({
        from: account.name
          ? `"${account.name}" <${account.email}>`
          : account.email,
        to: msg.to.join(", "),
        subject: msg.subject,
        text: msg.body,
        html: toHtml(msg.body),
      });
      return ok(undefined);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Error enviando desde Gmail.";
      if (/invalid_grant/i.test(message)) {
        return err(
          "La autorización de esta cuenta ha expirado o fue revocada. Vuelve a conectarla desde el panel.",
        );
      }
      // 535-5.7.8 typically means "the app doesn't have Gmail API enabled" or
      // "the account is in Testing and the refresh_token expired after 7 days".
      if (/535|BadCredentials|Username and Password not accepted/i.test(message)) {
        return err(
          "Gmail rechazó la autenticación. Comprueba que la Gmail API está habilitada en Google Cloud y desconecta/reconecta la cuenta.",
        );
      }
      return err(message);
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
