"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type Result, ok } from "@/shared/kernel/result";
import { getLogin } from "@/shared/di/container";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/shared/session";

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<Result<null>> {
  const res = await getLogin().execute(input.email, input.password);
  if (!res.ok) return res;

  const token = await createSessionToken({
    uid: res.value.uid,
    email: res.value.email,
    name: res.value.name,
    role: res.value.role,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return ok(null);
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
