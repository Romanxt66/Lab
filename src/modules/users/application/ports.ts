export type UserRole = "user" | "superadmin";

export interface User {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

export interface UserRepoPort {
  findByEmail(email: string): Promise<User | null>;
  /** Create the user, or update its password/name/role if the email exists. */
  upsertByEmail(input: {
    email: string;
    name?: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User>;
  count(): Promise<number>;
}
