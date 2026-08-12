import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/modules/auth/current-user";
import { LoginForm } from "@/modules/auth/ui/LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión — Lab" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already authenticated → go straight to the app.
  if (await getCurrentUser()) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <LoginForm initialError={error ?? null} />
    </main>
  );
}
