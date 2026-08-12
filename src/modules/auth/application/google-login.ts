import { type Result, ok, err } from "@/shared/kernel/result";
import type { UserRepoPort } from "@/modules/users/application/ports";
import type { SendNotification } from "@/modules/notifications/application/send-notification";
import type { AuthenticatedUser } from "./login";

export const GOOGLE_LOGIN_SCOPE = "openid email profile";

export interface GoogleProfile {
  email: string;
  name: string | null;
  picture: string | null;
}

/**
 * What happened once the Google identity was linked successfully. Awaiting
 * approval is a normal outcome — not an error — so the caller can show a
 * friendly "waiting" screen instead of a failure.
 */
export type GoogleLoginOutcome =
  | { kind: "session"; user: AuthenticatedUser }
  /** `isNew` distinguishes "we just created your account" from "still waiting". */
  | { kind: "pending"; isNew: boolean }
  | { kind: "rejected" };

/**
 * Sign in (or self-register) with a Google identity. A first-time email
 * creates a "pending" account and notifies the superadmin; only "approved"
 * accounts get a session. `err` is reserved for genuine failures.
 */
export class GoogleLoginUseCase {
  constructor(
    private readonly users: UserRepoPort,
    private readonly notifier: SendNotification,
  ) {}

  async execute(profile: GoogleProfile): Promise<Result<GoogleLoginOutcome>> {
    const email = profile.email.trim().toLowerCase();
    if (!email) return err("Google no devolvió un email válido.");

    const existing = await this.users.findByEmail(email);
    const isNew = !existing;
    let user = existing;
    if (!user) {
      user = await this.users.register({
        email,
        name: profile.name,
        picture: profile.picture,
        passwordHash: null,
      });
      await this.notifier.execute(
        `🆕 Nuevo registro pendiente de aprobación\n${profile.name ?? email}\n${email}`,
      );
    }

    if (user.status === "pending") return ok({ kind: "pending", isNew });
    if (user.status === "rejected") return ok({ kind: "rejected" });

    return ok({
      kind: "session",
      user: {
        uid: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  }
}
