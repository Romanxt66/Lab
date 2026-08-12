import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/modules/auth/current-user";
import { RegisterForm } from "@/modules/auth/ui/RegisterForm";

export const metadata: Metadata = { title: "Registrarse — Lab" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <RegisterForm />
    </main>
  );
}
