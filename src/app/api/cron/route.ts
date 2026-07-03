import { NextResponse } from "next/server";
import { env } from "@/shared/env";
import { getRunDueJobs } from "@/shared/di/container";

/**
 * HTTP cron trigger for cloud deployments (e.g. Vercel Cron calls this every
 * minute). Runs every enabled job whose cron expression is due right now.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>`. Fails closed in
 * production if no secret is configured.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (env.CRON_SECRET) {
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 401 },
    );
  }

  const result = await getRunDueJobs().execute();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
