import { type Result, ok, err } from "@/shared/kernel/result";
import type { WidgetDataProvider } from "./ports";
import type { Widget } from "@/modules/dashboard/domain/dashboard";
import type { CalendarRepoPort } from "@/modules/calendar/application/ports";
import type { JobRunRepoPort } from "@/modules/scheduler/application/ports";
import type { GoogleAccountRepoPort } from "@/modules/email/application/ports";

// ---- Upcoming events -----------------------------------------------------

export interface UpcomingEventDTO {
  id: string;
  title: string;
  start: string; // ISO
  allDay: boolean;
  location: string | null;
}

/**
 * Reads upcoming events straight from the calendar repo. Range is 30 days
 * forward — enough for a personal dashboard.
 */
export class UpcomingEventsProvider implements WidgetDataProvider {
  constructor(private readonly calendar: CalendarRepoPort) {}

  async provide(_: Widget): Promise<Result<UpcomingEventDTO[]>> {
    try {
      const now = new Date();
      const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const events = await this.calendar.listBetween(now, in30d);
      // Only future ones, sorted by start.
      const upcoming = events
        .filter((e) => e.start.getTime() >= now.getTime())
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 8)
        .map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start.toISOString(),
          allDay: e.allDay,
          location: e.location ?? null,
        }));
      return ok(upcoming);
    } catch (e) {
      return err(e instanceof Error ? e.message : "Error consultando eventos.");
    }
  }
}

// ---- Recent jobs ---------------------------------------------------------

export interface RecentJobDTO {
  id: string;
  jobName: string;
  status: "success" | "error";
  output: string | null;
  startedAt: string; // ISO
}

export class RecentJobsProvider implements WidgetDataProvider {
  constructor(private readonly runs: JobRunRepoPort) {}

  async provide(_: Widget): Promise<Result<RecentJobDTO[]>> {
    try {
      const rows = await this.runs.listRecent(10);
      return ok(
        rows.map((r) => ({
          id: r.id,
          jobName: r.jobName,
          status: r.status,
          output: r.output,
          startedAt: r.startedAt.toISOString(),
        })),
      );
    } catch (e) {
      return err(e instanceof Error ? e.message : "Error consultando jobs.");
    }
  }
}

// ---- Google accounts -----------------------------------------------------

export interface GoogleAccountLite {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export class GoogleAccountsProvider implements WidgetDataProvider {
  constructor(private readonly accounts: GoogleAccountRepoPort) {}

  async provide(_: Widget): Promise<Result<GoogleAccountLite[]>> {
    try {
      const list = await this.accounts.list();
      return ok(
        list.map((a) => ({
          id: a.id,
          email: a.email,
          name: a.name,
          picture: a.picture,
        })),
      );
    } catch (e) {
      return err(
        e instanceof Error ? e.message : "Error listando cuentas de Google.",
      );
    }
  }
}

// ---- Recent emails -------------------------------------------------------

export interface RecentEmailDTO {
  id: string;
  to: string;
  subject: string;
  status: "sent" | "failed";
  error: string | null;
  sentAt: string;
}

/**
 * Provider for the "recent emails" widget. Reads from the `lab_email_log`
 * table directly via Prisma — the existing EmailLogPort is write-only, and a
 * pure read for a dashboard doesn't warrant extending it.
 */
export class RecentEmailsProvider implements WidgetDataProvider {
  constructor(
    private readonly db: {
      emailLog: {
        findMany: (args: {
          orderBy: { sentAt: "desc" };
          take: number;
        }) => Promise<
          Array<{
            id: string;
            to: string;
            subject: string;
            status: string;
            error: string | null;
            sentAt: Date;
          }>
        >;
      };
    },
  ) {}

  async provide(_: Widget): Promise<Result<RecentEmailDTO[]>> {
    try {
      const rows = await this.db.emailLog.findMany({
        orderBy: { sentAt: "desc" },
        take: 10,
      });
      return ok(
        rows.map((r) => ({
          id: r.id,
          to: r.to,
          subject: r.subject,
          status: r.status as "sent" | "failed",
          error: r.error,
          sentAt: r.sentAt.toISOString(),
        })),
      );
    } catch (e) {
      return err(
        e instanceof Error ? e.message : "Error consultando correos.",
      );
    }
  }
}
