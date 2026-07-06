import "server-only";
import { db } from "@/shared/db";
import type {
  GoogleAccountRepoPort,
} from "@/modules/email/application/ports";
import type { GoogleAccount } from "@/modules/email/domain/google-account";

/** GoogleAccountRepoPort backed by Prisma (table `lab_google_account`). */
export class PrismaGoogleAccountRepo implements GoogleAccountRepoPort {
  list(): Promise<GoogleAccount[]> {
    return db.googleAccount.findMany({ orderBy: { createdAt: "asc" } });
  }

  get(id: string): Promise<GoogleAccount | null> {
    return db.googleAccount.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<GoogleAccount | null> {
    return db.googleAccount.findUnique({ where: { email } });
  }

  /**
   * Upsert by email. If the account already exists, we KEEP the previous
   * refresh_token when Google didn't return a new one (which happens on
   * re-consent without `prompt=consent`).
   */
  async upsert(input: {
    email: string;
    name: string | null;
    picture: string | null;
    refreshToken: string;
    accessToken: string | null;
    expiresAt: Date | null;
    scope: string;
  }): Promise<GoogleAccount> {
    const existing = await db.googleAccount.findUnique({
      where: { email: input.email },
    });
    const refreshToken = input.refreshToken || existing?.refreshToken || "";
    return db.googleAccount.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        name: input.name,
        picture: input.picture,
        refreshToken,
        accessToken: input.accessToken,
        expiresAt: input.expiresAt,
        scope: input.scope,
      },
      update: {
        name: input.name,
        picture: input.picture,
        refreshToken,
        accessToken: input.accessToken,
        expiresAt: input.expiresAt,
        scope: input.scope,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await db.googleAccount.delete({ where: { id } });
  }
}
