"use server";

import { type Result, ok, err } from "@/shared/kernel/result";
import { getSendEmail, getTemplateRepo } from "@/shared/di/container";
import { parseRecipients } from "@/modules/email/domain/email";
import type {
  EmailTemplate,
  TemplateInput,
} from "@/modules/email/application/ports";
import type { SendEmailResult } from "@/modules/email/application/send-email";

/**
 * Server Actions = the HTTP entry adapter for the email module. They translate
 * UI input into use-case calls via the DI container. No business logic here.
 */

export async function sendEmailAction(input: {
  recipients: string;
  subject: string;
  body: string;
  variables?: Record<string, string>;
}): Promise<Result<SendEmailResult>> {
  const { valid, invalid } = parseRecipients(input.recipients);
  if (invalid.length) {
    return err(`Destinatarios con formato inválido: ${invalid.join(", ")}`);
  }
  return getSendEmail().execute({
    to: valid,
    subject: input.subject,
    body: input.body,
    variables: input.variables,
  });
}

export async function listTemplatesAction(): Promise<EmailTemplate[]> {
  return getTemplateRepo().list();
}

export async function saveTemplateAction(
  input: TemplateInput & { id?: string },
): Promise<Result<EmailTemplate>> {
  if (!input.name.trim()) return err("La plantilla necesita un nombre.");
  const repo = getTemplateRepo();
  const data: TemplateInput = {
    name: input.name,
    subject: input.subject,
    body: input.body,
  };
  const saved = input.id
    ? await repo.update(input.id, data)
    : await repo.create(data);
  return ok(saved);
}

export async function deleteTemplateAction(id: string): Promise<void> {
  await getTemplateRepo().remove(id);
}
