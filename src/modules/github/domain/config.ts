import { type Result, ok, err } from "@/shared/kernel/result";

/**
 * GitHub connection config. `token` is a personal access token (optional): with
 * it, private repos and a higher rate limit are available; without it, only
 * public repos are listed.
 */
export interface GitHubConfig {
  id: string;
  username: string;
  token: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Client-side projection: the token itself never reaches the browser. */
export interface GitHubConfigDTO {
  id: string;
  username: string;
  hasToken: boolean;
}

export function toConfigDTO(c: GitHubConfig): GitHubConfigDTO {
  return {
    id: c.id,
    username: c.username,
    hasToken: Boolean(c.token),
  };
}

/**
 * GitHub usernames: 1–39 chars, alphanumeric or single hyphens, cannot start
 * or end with a hyphen. Mirrors GitHub's own signup rule.
 */
export function validateUsername(raw: string): Result<string> {
  const trimmed = raw.trim();
  if (!trimmed) return err("Introduce tu usuario de GitHub.");
  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(trimmed)
  ) {
    return err(
      "El usuario no es válido (letras, números y guiones simples, máx. 39).",
    );
  }
  return ok(trimmed);
}

/**
 * A classic PAT looks like `ghp_...`; fine-grained ones like
 * `github_pat_...`. We only sanity-check length/charset so we don't reject a
 * valid future format — the real validation is GitHub answering 401.
 */
export function normaliseToken(raw: string): string | null {
  const t = raw.trim();
  return t.length > 0 ? t : null;
}
