import { type Result, ok, err } from "@/shared/kernel/result";
import type { UserRepoPort } from "@/modules/users/application/ports";
import type { SendNotification } from "@/modules/notifications/application/send-notification";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Self-registration with email + password. Always lands as "pending" — the
 * superadmin must approve before the account can log in.
 */
export class RegisterUseCase {
  constructor(
    private readonly users: UserRepoPort,
    private readonly hash: (plain: string) => string,
    private readonly notifier: SendNotification,
  ) {}

  async execute(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<Result<null>> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (!email || !name) return err("Completa tu nombre y email.");
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      return err(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    const existing = await this.users.findByEmail(email);
    if (existing) return err("Ya existe una cuenta con ese email.");

    await this.users.register({
      email,
      name,
      picture: null,
      passwordHash: this.hash(input.password),
    });
    await this.notifier.execute(
      `🆕 Nuevo registro pendiente de aprobación\n${name}\n${email}`,
    );
    return ok(null);
  }
}
