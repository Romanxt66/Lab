import { type Result, ok, err } from "@/shared/kernel/result";
import { renderTemplate } from "@/modules/email/domain/template";
import { validateMessage } from "@/modules/email/domain/email";
import type { MailSenderPort, EmailLogPort } from "./ports";

export interface SendEmailInput {
  to: string[];
  subject: string;
  body: string;
  /** Values for `{{variable}}` placeholders in subject/body. */
  variables?: Record<string, string>;
}

export interface SendEmailResult {
  sent: number;
  failed: number;
}

/**
 * SendEmail use-case. Renders the template, validates, then sends one message
 * per recipient (privacy + per-recipient logging). Depends only on ports, so
 * it can be unit-tested with in-memory fakes — no SMTP required.
 */
export class SendEmail {
  constructor(
    private readonly sender: MailSenderPort,
    private readonly log?: EmailLogPort,
  ) {}

  execute(input: SendEmailInput): Promise<Result<SendEmailResult>> {
    return this.executeWithSender(this.sender, input);
  }

  /**
   * Same use-case, but with an ad-hoc sender: lets callers pick a different
   * transport per send (e.g. a specific connected Gmail account) without
   * rebuilding the whole use-case.
   */
  async executeWithSender(
    sender: MailSenderPort,
    input: SendEmailInput,
  ): Promise<Result<SendEmailResult>> {
    const vars = input.variables ?? {};
    const subject = renderTemplate(input.subject, vars);
    const body = renderTemplate(input.body, vars);

    const base = validateMessage({ to: input.to, subject, body });
    if (!base.ok) return base;

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of input.to) {
      const res = await sender.send({ to: [recipient], subject, body });
      if (res.ok) {
        sent++;
        await this.log?.record({ to: recipient, subject, status: "sent" });
      } else {
        failed++;
        errors.push(`${recipient}: ${res.error}`);
        await this.log?.record({
          to: recipient,
          subject,
          status: "failed",
          error: res.error,
        });
      }
    }

    if (sent === 0) {
      return err(`No se pudo enviar ningún correo. ${errors.join("; ")}`);
    }
    return ok({ sent, failed });
  }
}
