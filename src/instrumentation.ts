/**
 * Next.js instrumentation hook — runs once when the server starts.
 * In the Node.js runtime we boot the local cron scheduler so enabled jobs
 * start firing on their schedules, plus the built-in system tasks (calendar
 * reminders). Guarded so it never runs on the Edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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
