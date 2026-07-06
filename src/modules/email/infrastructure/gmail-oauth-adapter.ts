import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { type Result, ok, err } from "@/shared/kernel/result";
import { assertGoogleOAuth } from "@/shared/env";
import type { EmailMessage } from "@/modules/email/domain/email";
import type {
  AccountMailSenderPort,
  GoogleAccountRepoPort,
} from "@/modules/email/application/ports";

/**
 * AccountMailSenderPort implementation over Nodemailer + XOAUTH2 against Gmail
 * SMTP. Nodemailer handles access-token refresh transparently when we provide
 * clientId/clientSecret/refreshToken.
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
        "La cuenta no tiene refresh_token. Vuelve a conectar la cuenta.",
      );
    }

    let cfg;
    try {
      cfg = assertGoogleOAuth();
    } catch (e) {
      return err(e instanceof Error ? e.message : "Google OAuth no configurado.");
    }

    try {
      const transporter: Transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: account.email,
          clientId: cfg.GOOGLE_CLIENT_ID,
          clientSecret: cfg.GOOGLE_CLIENT_SECRET,
          refreshToken: account.refreshToken,
          accessToken: account.accessToken ?? undefined,
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
      // Common signal that refresh_token was revoked (e.g. password change).
      if (/invalid_grant/i.test(message)) {
        return err(
          "La autorización de esta cuenta ha expirado o fue revocada. Vuelve a conectarla.",
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
