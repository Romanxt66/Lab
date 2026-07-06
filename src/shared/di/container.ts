import "server-only";
import { ok, type Result } from "@/shared/kernel/result";
import { SendEmail } from "@/modules/email/application/send-email";
import { NodemailerAdapter } from "@/modules/email/infrastructure/nodemailer-adapter";
import {
  PrismaTemplateRepo,
  PrismaEmailLog,
} from "@/modules/email/infrastructure/prisma-template-repo";
import type {
  TemplateRepoPort,
  GoogleAccountRepoPort,
  AccountMailSenderPort,
} from "@/modules/email/application/ports";
import { PrismaGoogleAccountRepo } from "@/modules/email/infrastructure/prisma-google-account-repo";
import { GmailOAuthAdapter } from "@/modules/email/infrastructure/gmail-oauth-adapter";
import { SendWhatsAppMessage } from "@/modules/whatsapp/application/send-message";
import { CallMeBotAdapter } from "@/modules/whatsapp/infrastructure/callmebot-adapter";
import { PrismaWhatsAppConfigRepo } from "@/modules/whatsapp/infrastructure/prisma-whatsapp-config-repo";
import type { WhatsAppConfigRepoPort } from "@/modules/whatsapp/application/ports";
import { parseRecipients } from "@/modules/email/domain/email";
import { RunScrape } from "@/modules/scraper/application/run-scrape";
import { FetchWebFetcher } from "@/modules/scraper/infrastructure/fetch-web-fetcher";
import { CheerioExtractor } from "@/modules/scraper/infrastructure/cheerio-extractor";
import { RunJob, RunDueJobs } from "@/modules/scheduler/application/run-job";
import {
  PrismaJobRepo,
  PrismaJobRunRepo,
} from "@/modules/scheduler/infrastructure/prisma-job-repo";
import type {
  ScheduledJobRepoPort,
  JobRunRepoPort,
  JobAction,
  JobActionHandler,
} from "@/modules/scheduler/application/ports";
import { CalendarService } from "@/modules/calendar/application/calendar-service";
import { PrismaCalendarRepo } from "@/modules/calendar/infrastructure/prisma-calendar-repo";
import { ProcessCalendarReminders } from "@/modules/calendar/application/process-reminders";
import { PrismaUserRepo } from "@/modules/users/infrastructure/prisma-user-repo";
import type { UserRepoPort } from "@/modules/users/application/ports";
import { LoginUseCase } from "@/modules/auth/application/login";
import { verifyPassword } from "@/shared/password";

/**
 * Composition root — the ONLY place where use-cases are wired to concrete
 * adapters. Swapping an implementation (e.g. Nodemailer → Resend, SQLite →
 * Postgres) happens here; nothing in domain/application changes.
 */

// --- Email -----------------------------------------------------------------

export function getTemplateRepo(): TemplateRepoPort {
  return new PrismaTemplateRepo();
}

export function getSendEmail(): SendEmail {
  return new SendEmail(new NodemailerAdapter(), new PrismaEmailLog());
}

export function getGoogleAccountRepo(): GoogleAccountRepoPort {
  return new PrismaGoogleAccountRepo();
}

export function getGmailOAuthSender(): AccountMailSenderPort {
  return new GmailOAuthAdapter(getGoogleAccountRepo());
}

// --- WhatsApp -------------------------------------------------------------

export function getWhatsAppConfigRepo(): WhatsAppConfigRepoPort {
  return new PrismaWhatsAppConfigRepo();
}

export function getSendWhatsApp(): SendWhatsAppMessage {
  return new SendWhatsAppMessage(
    new CallMeBotAdapter(),
    getWhatsAppConfigRepo(),
  );
}

// --- Scraper ---------------------------------------------------------------

export function getRunScrape(): RunScrape {
  return new RunScrape(new FetchWebFetcher(), new CheerioExtractor());
}

// --- Scheduler -------------------------------------------------------------

export function getJobRepo(): ScheduledJobRepoPort {
  return new PrismaJobRepo();
}

export function getJobRunRepo(): JobRunRepoPort {
  return new PrismaJobRunRepo();
}

/** Wires each job action type to its use-case. RunJob stays decoupled. */
function buildActionHandlers(): Record<JobAction, JobActionHandler> {
  return {
    email: async (raw): Promise<Result<string>> => {
      const p = raw as {
        recipients?: string;
        subject?: string;
        body?: string;
        variables?: Record<string, string>;
      };
      const { valid } = parseRecipients(p.recipients ?? "");
      const res = await getSendEmail().execute({
        to: valid,
        subject: p.subject ?? "",
        body: p.body ?? "",
        variables: p.variables,
      });
      return res.ok ? ok(`Enviado a ${res.value.sent} destinatario(s).`) : res;
    },
    scrape: async (raw): Promise<Result<string>> => {
      const p = raw as { url: string; selector?: string; attribute?: string };
      const res = await getRunScrape().execute(p);
      if (!res.ok) return res;
      return ok(
        res.value.items
          ? `${res.value.items.length} resultado(s).`
          : `${res.value.raw?.length ?? 0} bytes recibidos.`,
      );
    },
  };
}

export function getRunJob(): RunJob {
  return new RunJob(getJobRepo(), getJobRunRepo(), buildActionHandlers());
}

export function getRunDueJobs(): RunDueJobs {
  return new RunDueJobs(getJobRepo(), getRunJob());
}

// --- Calendar --------------------------------------------------------------

export function getCalendarService(): CalendarService {
  return new CalendarService(new PrismaCalendarRepo());
}

export function getProcessCalendarReminders(): ProcessCalendarReminders {
  return new ProcessCalendarReminders(
    new PrismaCalendarRepo(),
    getSendWhatsApp(),
  );
}

// --- Users -----------------------------------------------------------------

export function getUserRepo(): UserRepoPort {
  return new PrismaUserRepo();
}

// --- Auth ------------------------------------------------------------------

export function getLogin(): LoginUseCase {
  return new LoginUseCase(getUserRepo(), verifyPassword);
}
