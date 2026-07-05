import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/modules/auth/current-user";
import { LoginForm } from "@/modules/auth/ui/LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión — Lab" };

export default async function LoginPage() {
  // Already authenticated → go straight to the app.
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <LoginForm />
    </main>
  );
}
