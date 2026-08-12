import { getCurrentUser } from "@/modules/auth/current-user";
import { HomeHeader } from "./HomeHeader";
import { HomeDashboard } from "./HomeDashboard";

/**
 * Home / dashboard. Landing after login: a greeting, usage stats, most-used and
 * recent tools, the full tool grid, and a live personalization panel.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  const displayName = user?.name || user?.email?.split("@")[0] || null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="animate-enter mb-8">
        <HomeHeader name={displayName} />
        <p className="mt-2 text-[15px] text-muted-foreground">
          Elige una herramienta para empezar.
        </p>
      </header>

      <HomeDashboard role={user?.role} />
    </div>
  );
}
