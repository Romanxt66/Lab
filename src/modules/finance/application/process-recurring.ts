import {
  dueOccurrences,
  shouldRemind,
  FREQUENCY_LABELS,
  type RecurringPayment,
} from "@/modules/finance/domain/recurring";
import { formatMoney } from "@/modules/finance/domain/money";
import type {
  AccountRepoPort,
  RecurringRepoPort,
  TransactionRepoPort,
} from "./ports";
import type { SendNotification } from "@/modules/notifications/application/send-notification";

export interface ProcessRecurringSummary {
  /** Transactions auto-created from due occurrences. */
  created: number;
  /** Reminders sent to the notification channel. */
  reminded: number;
  errors: string[];
}

/**
 * Processes recurring payments: for each active payment, creates a transaction
 * for every occurrence due at or before `now` (backfilling missed ones),
 * advances the schedule, and fires a Telegram reminder when we're inside the
 * reminder window and haven't already notified for the current cycle.
 *
 * Designed to be called on a cron tick — it's idempotent per-cycle because
 * reminders are gated on `reminderSentAt` and the schedule only moves forward.
 */
export class ProcessRecurring {
  constructor(
    private readonly recurring: RecurringRepoPort,
    private readonly transactions: TransactionRepoPort,
    private readonly accounts: AccountRepoPort,
    private readonly notifier: SendNotification,
  ) {}

  async execute(now = new Date()): Promise<ProcessRecurringSummary> {
    const summary: ProcessRecurringSummary = {
      created: 0,
      reminded: 0,
      errors: [],
    };
    const payments = await this.recurring.list(true);
    const currencyCache = new Map<string, string>();

    for (const p of payments) {
      try {
        // 1. Reminder (before we advance the schedule).
        if (shouldRemind(p, now)) {
          const currency = await this.currencyFor(p.accountId, currencyCache);
          const res = await this.notifier.execute(
            this.reminderMessage(p, currency),
          );
          if (res.ok) {
            await this.recurring.markReminded(p.id, now);
            summary.reminded++;
          } else {
            summary.errors.push(`Recordatorio "${p.name}": ${res.error}`);
          }
        }

        // 2. Due occurrences → transactions.
        const { occurrences, newNextRunAt } = dueOccurrences(
          p.nextRunAt,
          p.frequency,
          now,
        );
        if (occurrences.length === 0) continue;

        for (const occurredAt of occurrences) {
          await this.transactions.create({
            accountId: p.accountId,
            categoryId: p.categoryId,
            kind: p.kind,
            amount: p.amount,
            occurredAt,
            notes: `Automático · ${p.name}`,
          });
          summary.created++;
        }
        // Advance schedule and reset the reminder flag for the new cycle.
        await this.recurring.markProcessed(p.id, newNextRunAt);
      } catch (e) {
        summary.errors.push(
          `Pago "${p.name}": ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return summary;
  }

  private async currencyFor(
    accountId: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const cached = cache.get(accountId);
    if (cached) return cached;
    const account = await this.accounts.get(accountId);
    const currency = account?.currency ?? "USD";
    cache.set(accountId, currency);
    return currency;
  }

  private reminderMessage(p: RecurringPayment, currency: string): string {
    const when = p.nextRunAt.toLocaleDateString("es", {
      day: "numeric",
      month: "long",
    });
    const verb = p.kind === "income" ? "Cobro" : "Pago";
    return (
      `🔔 ${verb} próximo: *${p.name}*\n` +
      `${formatMoney(p.amount, currency)} · ${when}\n` +
      `(${FREQUENCY_LABELS[p.frequency]})`
    );
  }
}
