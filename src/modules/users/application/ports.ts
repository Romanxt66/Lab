export type UserRole = "user" | "superadmin";
export type UserStatus = "pending" | "approved" | "rejected";

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  /** Null for accounts created via Google-only sign-in. */
  passwordHash: string | null;
  role: UserRole;
  status: UserStatus;
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
  /** Self-registration (Google or password form): always created as "pending" / "user". */
  register(input: {
    email: string;
    name?: string | null;
    picture?: string | null;
    passwordHash: string | null;
  }): Promise<User>;
  list(): Promise<User[]>;
  updateStatus(id: string, status: UserStatus): Promise<User>;
  updateRole(id: string, role: UserRole): Promise<User>;
  count(): Promise<number>;
}
