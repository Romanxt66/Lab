/** A Google account connected via OAuth to send email as that user. */
export interface GoogleAccount {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: Date | null;
  scope: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Serializable projection sent to the client (no tokens). */
export interface GoogleAccountDTO {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export function toGoogleAccountDTO(a: GoogleAccount): GoogleAccountDTO {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    picture: a.picture,
  };
}

/** OAuth scope required to send email as the user (Gmail SMTP + user info). */
export const GMAIL_SEND_SCOPE =
  "openid email profile https://www.googleapis.com/auth/gmail.send";
