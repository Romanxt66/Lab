import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { PageTransition } from "@/components/page-transition";
import { getCurrentUser } from "@/modules/auth/current-user";
import { AssistantWidget } from "@/modules/assistant/ui/AssistantWidget";

/** Authenticated app shell. Middleware guards routing; this is defense in depth. */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-10 flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border/70 px-6">
          <ThemeToggle />
          <UserMenu email={user.email} name={user.name} />
        </header>
        <main className="flex-1 overflow-y-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <AssistantWidget />
    </div>
  );
}
