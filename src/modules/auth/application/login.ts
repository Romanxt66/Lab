import { type Result, ok, err } from "@/shared/kernel/result";
import type { UserRepoPort } from "@/modules/users/application/ports";

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string | null;
  role: string;
}

/**
 * LoginUseCase: verify email + password against the user repo. The password
 * verifier is injected so the use-case has no dependency on the hashing impl.
 */
export class LoginUseCase {
  constructor(
    private readonly users: UserRepoPort,
    private readonly verify: (plain: string, hash: string) => boolean,
  ) {}

  async execute(
    email: string,
    password: string,
  ): Promise<Result<AuthenticatedUser>> {
    const normalized = email.trim();
    if (!normalized || !password) {
      return err("Introduce email y contraseña.");
    }
    const user = await this.users.findByEmail(normalized);
    // Same message whether the user is missing or the password is wrong, to
    // avoid leaking which emails exist.
    if (!user || !this.verify(password, user.passwordHash)) {
      return err("Credenciales inválidas.");
    }
    return ok({
      uid: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }
}
