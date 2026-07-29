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
import { SendNotification } from "@/modules/notifications/application/send-notification";
import { TelegramAdapter } from "@/modules/notifications/infrastructure/telegram-adapter";
import { PrismaNotificationConfigRepo } from "@/modules/notifications/infrastructure/prisma-notification-config-repo";
import type { NotificationConfigRepoPort } from "@/modules/notifications/application/ports";
import { DbAdminService } from "@/modules/db-admin/application/db-admin-service";
import { PrismaDbConnectionRepo } from "@/modules/db-admin/infrastructure/prisma-connection-repo";
import { PgExecutor } from "@/modules/db-admin/infrastructure/pg-executor";
import { PgIntrospection } from "@/modules/db-admin/infrastructure/pg-introspection";
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
import { FinanceService } from "@/modules/finance/application/finance-service";
import { ProcessRecurring } from "@/modules/finance/application/process-recurring";
import { PrismaAccountRepo } from "@/modules/finance/infrastructure/prisma-account-repo";
import { PrismaCategoryRepo } from "@/modules/finance/infrastructure/prisma-category-repo";
import { PrismaTransactionRepo } from "@/modules/finance/infrastructure/prisma-transaction-repo";
import { PrismaBudgetRepo } from "@/modules/finance/infrastructure/prisma-budget-repo";
import { PrismaRecurringRepo } from "@/modules/finance/infrastructure/prisma-recurring-repo";
import { CoolifyService } from "@/modules/coolify/application/coolify-service";
import { CoolifyRestAdapter } from "@/modules/coolify/infrastructure/coolify-rest-adapter";
import { PrismaCoolifyConfigRepo } from "@/modules/coolify/infrastructure/prisma-coolify-config-repo";
import { InventoryService } from "@/modules/inventory/application/inventory-service";
import { PrismaLocationRepo } from "@/modules/inventory/infrastructure/prisma-location-repo";
import { PrismaItemRepo } from "@/modules/inventory/infrastructure/prisma-item-repo";
import { PrismaMovementRepo } from "@/modules/inventory/infrastructure/prisma-movement-repo";
import { GitHubService } from "@/modules/github/application/github-service";
import { PrismaGitHubConfigRepo } from "@/modules/github/infrastructure/prisma-github-config-repo";
import { GitHubRestAdapter } from "@/modules/github/infrastructure/github-rest-adapter";

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

// --- Notifications --------------------------------------------------------

export function getNotificationConfigRepo(): NotificationConfigRepoPort {
  return new PrismaNotificationConfigRepo();
}

export function getSendNotification(): SendNotification {
  return new SendNotification(
    new TelegramAdapter(),
    getNotificationConfigRepo(),
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
    getSendNotification(),
  );
}

// --- Finance ---------------------------------------------------------------

export function getFinanceService(): FinanceService {
  return new FinanceService(
    new PrismaAccountRepo(),
    new PrismaCategoryRepo(),
    new PrismaTransactionRepo(),
    new PrismaBudgetRepo(),
    new PrismaRecurringRepo(),
  );
}

export function getProcessRecurring(): ProcessRecurring {
  return new ProcessRecurring(
    new PrismaRecurringRepo(),
    new PrismaTransactionRepo(),
    new PrismaAccountRepo(),
    getSendNotification(),
  );
}

// --- Coolify ---------------------------------------------------------------

export function getCoolifyService(): CoolifyService {
  return new CoolifyService(
    new CoolifyRestAdapter(),
    new PrismaCoolifyConfigRepo(),
  );
}

// --- Inventory -------------------------------------------------------------

export function getInventoryService(): InventoryService {
  return new InventoryService(
    new PrismaLocationRepo(),
    new PrismaItemRepo(),
    new PrismaMovementRepo(),
  );
}

// --- GitHub ----------------------------------------------------------------

export function getGitHubService(): GitHubService {
  return new GitHubService(new PrismaGitHubConfigRepo(), new GitHubRestAdapter());
}

// --- DB Admin --------------------------------------------------------------

export function getDbAdminService(): DbAdminService {
  return new DbAdminService(
    new PrismaDbConnectionRepo(),
    new PgExecutor(),
    new PgIntrospection(),
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
