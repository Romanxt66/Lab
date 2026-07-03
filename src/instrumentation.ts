/**
 * Next.js instrumentation hook — runs once when the server starts.
 * In the Node.js runtime we boot the local cron scheduler so enabled jobs
 * start firing on their schedules. (Guarded so it never runs on the Edge runtime.)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { syncCronJobs } = await import(
      "@/modules/scheduler/infrastructure/node-cron-scheduler"
    );
    try {
      const n = await syncCronJobs();
      console.log(`[scheduler] ${n} job(s) programados.`);
    } catch (e) {
      console.error("[scheduler] no se pudo iniciar:", e);
    }
  }
}
