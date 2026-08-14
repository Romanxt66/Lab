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
import { GoogleLoginUseCase } from "@/modules/auth/application/google-login";
import { RegisterUseCase } from "@/modules/auth/application/register";
import { verifyPassword, hashPassword } from "@/shared/password";
import { UserAdminService } from "@/modules/users/application/user-admin-service";
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
import { DeploygenService } from "@/modules/deploygen/application/deploygen-service";
import { GitHubRepoFetcher } from "@/modules/deploygen/infrastructure/github-repo-fetcher";
import { UptimeService } from "@/modules/uptime/application/uptime-service";
import { PrismaMonitorRepo } from "@/modules/uptime/infrastructure/prisma-monitor-repo";
import { PrismaCheckRepo } from "@/modules/uptime/infrastructure/prisma-check-repo";
import { FetchHttpProbe } from "@/modules/uptime/infrastructure/fetch-http-probe";
import { AutomationService } from "@/modules/automations/application/automation-service";
import { PrismaAutomationRepo } from "@/modules/automations/infrastructure/prisma-automation-repo";
import { FetchWebhookAdapter } from "@/modules/automations/infrastructure/fetch-webhook-adapter";
import { N8nService } from "@/modules/n8n/application/n8n-service";
import { N8nRestAdapter } from "@/modules/n8n/infrastructure/n8n-rest-adapter";
import { PrismaN8nConfigRepo } from "@/modules/n8n/infrastructure/prisma-n8n-config-repo";
import { AssistantService } from "@/modules/assistant/application/assistant-service";
import { buildAssistantTools } from "@/modules/assistant/application/tools";
import { AnthropicRestClient } from "@/modules/assistant/infrastructure/anthropic-client";

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

// --- Automations -------------------------------------------------------------

export function getAutomationService(): AutomationService {
  return new AutomationService(
    new PrismaAutomationRepo(),
    getSendNotification(),
    getCalendarService(),
    new FetchWebhookAdapter(),
  );
}

// --- n8n ---------------------------------------------------------------------

export function getN8nService(): N8nService {
  return new N8nService(new N8nRestAdapter(), new PrismaN8nConfigRepo());
}

// --- Finance ---------------------------------------------------------------

export function getFinanceService(): FinanceService {
  return new FinanceService(
    new PrismaAccountRepo(),
    new PrismaCategoryRepo(),
    new PrismaTransactionRepo(),
    new PrismaBudgetRepo(),
    new PrismaRecurringRepo(),
    getAutomationService(),
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

// --- Deploygen (auto-deploy generator) -------------------------------------

export function getDeploygenService(): DeploygenService {
  const githubConfig = new PrismaGitHubConfigRepo();
  return new DeploygenService(
    new GitHubRepoFetcher(),
    async () => (await githubConfig.getActive())?.token ?? null,
  );
}

// --- Uptime monitoring -----------------------------------------------------

export function getUptimeService(): UptimeService {
  return new UptimeService(
    new PrismaMonitorRepo(),
    new PrismaCheckRepo(),
    new FetchHttpProbe(),
    getSendNotification(),
    getAutomationService(),
  );
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

export function getUserAdminService(): UserAdminService {
  return new UserAdminService(getUserRepo());
}

// --- Auth ------------------------------------------------------------------

export function getLogin(): LoginUseCase {
  return new LoginUseCase(getUserRepo(), verifyPassword);
}

export function getGoogleLogin(): GoogleLoginUseCase {
  return new GoogleLoginUseCase(getUserRepo(), getSendNotification(), getAutomationService());
}

export function getRegister(): RegisterUseCase {
  return new RegisterUseCase(
    getUserRepo(),
    hashPassword,
    getSendNotification(),
    getAutomationService(),
  );
}

// --- Assistant ---------------------------------------------------------------

export function getAssistantService(): AssistantService {
  const tools = buildAssistantTools({
    finance: getFinanceService(),
    uptime: getUptimeService(),
    users: getUserAdminService(),
    calendar: getCalendarService(),
    inventory: getInventoryService(),
    automations: getAutomationService(),
  });
  return new AssistantService(new AnthropicRestClient(), tools);
}
