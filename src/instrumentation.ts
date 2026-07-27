/**
 * Next.js instrumentation hook — runs once when the server starts.
 * In the Node.js runtime we boot the local cron scheduler so enabled jobs
 * start firing on their schedules, plus the built-in system tasks (calendar
 * reminders). Guarded so it never runs on the Edge runtime.
 *
 * Set DISABLE_SCHEDULER=true to skip all cron work. Use this when running the
 * dev server against the PRODUCTION database (via the SSH tunnel) so the local
 * process doesn't double-fire reminders/recurring payments alongside the
 * deployed instance. Production leaves the flag unset.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_SCHEDULER === "true") {
    console.log("[scheduler] desactivado (DISABLE_SCHEDULER=true).");
    return;
  }

  const mod = await import(
    "@/modules/scheduler/infrastructure/node-cron-scheduler"
  );

  try {
    const n = await mod.syncCronJobs();
    console.log(`[scheduler] ${n} job(s) programados.`);
  } catch (e) {
    console.error("[scheduler] no se pudo iniciar:", e);
  }

  try {
    mod.startSystemCronTasks();
    console.log("[scheduler] recordatorios de calendario activados.");
  } catch (e) {
    console.error("[scheduler] no se pudo iniciar system tasks:", e);
  }
}
