import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { type Result, ok, err } from "@/shared/kernel/result";
import { assertSmtp } from "@/shared/env";
import type { EmailMessage } from "@/modules/email/domain/email";
import type { MailSenderPort } from "@/modules/email/application/ports";

/**
 * MailSenderPort implementation over SMTP (Nodemailer). Swappable for a
 * ResendAdapter in production without touching the domain or use-cases.
 */
export class NodemailerAdapter implements MailSenderPort {
  private transporter: Transporter | null = null;
  private from = "";

  private ensure(): Transporter {
    if (this.transporter) return this.transporter;
    const smtp = assertSmtp(); // throws a friendly error if unconfigured
    this.from = smtp.SMTP_FROM;
    this.transporter = nodemailer.createTransport({
      host: smtp.SMTP_HOST,
      port: smtp.SMTP_PORT,
      secure: smtp.SMTP_PORT === 465,
      auth: { user: smtp.SMTP_USER, pass: smtp.SMTP_PASS },
    });
    return this.transporter;
  }

  async send(msg: EmailMessage): Promise<Result<void>> {
    try {
      const transporter = this.ensure();
      await transporter.sendMail({
        from: this.from,
        to: msg.to.join(", "),
        subject: msg.subject,
        text: msg.body,
        html: toHtml(msg.body),
      });
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e.message : "Error SMTP desconocido.");
    }
  }
}

/** Minimal text→HTML: preserve line breaks. */
function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br>");
}
