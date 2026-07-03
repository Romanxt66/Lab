import "server-only";
import { db } from "@/shared/db";
import type {
  TemplateRepoPort,
  TemplateInput,
  EmailTemplate,
} from "@/modules/email/application/ports";

/** TemplateRepoPort backed by Prisma/SQLite. */
export class PrismaTemplateRepo implements TemplateRepoPort {
  list(): Promise<EmailTemplate[]> {
    return db.emailTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  }

  get(id: string): Promise<EmailTemplate | null> {
    return db.emailTemplate.findUnique({ where: { id } });
  }

  create(input: TemplateInput): Promise<EmailTemplate> {
    return db.emailTemplate.create({ data: input });
  }

  update(id: string, input: TemplateInput): Promise<EmailTemplate> {
    return db.emailTemplate.update({ where: { id }, data: input });
  }

  async remove(id: string): Promise<void> {
    await db.emailTemplate.delete({ where: { id } });
  }
}

/** EmailLogPort backed by Prisma/SQLite. */
export class PrismaEmailLog {
  async record(entry: {
    to: string;
    subject: string;
    status: "sent" | "failed";
    error?: string;
  }): Promise<void> {
    await db.emailLog.create({
      data: {
        to: entry.to,
        subject: entry.subject,
        status: entry.status,
        error: entry.error ?? null,
      },
    });
  }
}
