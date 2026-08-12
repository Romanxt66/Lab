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
 * Sign in (or self-register) with a Google identity. A first-time email
 * creates a "pending" account and notifies the superadmin; only "approved"
 * accounts get a session.
 */
export class GoogleLoginUseCase {
  constructor(
    private readonly users: UserRepoPort,
    private readonly notifier: SendNotification,
  ) {}

  async execute(profile: GoogleProfile): Promise<Result<AuthenticatedUser>> {
    const email = profile.email.trim().toLowerCase();
    if (!email) return err("Google no devolvió un email válido.");

    let user = await this.users.findByEmail(email);
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

    if (user.status === "pending") {
      return err("Tu cuenta está pendiente de aprobación por el administrador.");
    }
    if (user.status === "rejected") {
      return err("Tu acceso fue rechazado. Contacta al administrador.");
    }

    return ok({
      uid: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }
}
