import type { Result } from "@/shared/kernel/result";
import type { EmailMessage } from "@/modules/email/domain/email";
import type { GoogleAccount } from "@/modules/email/domain/google-account";

/**
 * Ports = the interfaces the application layer depends on. Concrete adapters
 * (Nodemailer, Prisma) live in `infrastructure/` and are wired in the DI
 * container. The use-cases below never import those adapters directly.
 */

export interface MailSenderPort {
  send(msg: EmailMessage): Promise<Result<void>>;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateInput = Pick<
  EmailTemplate,
  "name" | "subject" | "body"
>;

export interface TemplateRepoPort {
  list(): Promise<EmailTemplate[]>;
  get(id: string): Promise<EmailTemplate | null>;
  create(input: TemplateInput): Promise<EmailTemplate>;
  update(id: string, input: TemplateInput): Promise<EmailTemplate>;
  remove(id: string): Promise<void>;
}

export interface EmailLogPort {
  record(entry: {
    to: string;
    subject: string;
    status: "sent" | "failed";
    error?: string;
  }): Promise<void>;
}

/** Repo of Google accounts connected for sending email. */
export interface GoogleAccountRepoPort {
  list(): Promise<GoogleAccount[]>;
  get(id: string): Promise<GoogleAccount | null>;
  findByEmail(email: string): Promise<GoogleAccount | null>;
  upsert(input: {
    email: string;
    name: string | null;
    picture: string | null;
    refreshToken: string;
    accessToken: string | null;
    expiresAt: Date | null;
    scope: string;
  }): Promise<GoogleAccount>;
  remove(id: string): Promise<void>;
}

/**
 * A mail sender that can send FROM a specific connected Google account.
 * Distinct from MailSenderPort (single SMTP identity) — this one is scoped by
 * accountId, so the caller chooses which Gmail account to send from.
 */
export interface AccountMailSenderPort {
  sendFrom(accountId: string, msg: EmailMessage): Promise<Result<void>>;
}
