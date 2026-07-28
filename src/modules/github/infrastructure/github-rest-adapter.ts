import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import type {
  GitHubClientPort,
  GitHubCredentials,
} from "@/modules/github/application/ports";
import type { GitHubProfile, GitHubRepo } from "@/modules/github/domain/repo";

const API = "https://api.github.com";
const TIMEOUT_MS = 15_000;
const PER_PAGE = 100;
/** Cap pagination so a huge account can't hang the request (5 × 100 = 500). */
const MAX_PAGES = 5;

/** Raw REST shapes (only the fields we consume). */
interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics?: string[];
  pushed_at: string | null;
  updated_at: string | null;
  default_branch: string;
}

interface RawUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  html_url: string;
  public_repos: number;
  followers: number;
  following: number;
  company: string | null;
  location: string | null;
  blog: string | null;
}

function headers(token: string | null): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Lab-GitHub-Tool",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Turn a non-2xx response into a friendly, localised error. */
async function toError(res: Response): Promise<string> {
  if (res.status === 401) {
    return "Token inválido o expirado. Revisa tu personal access token.";
  }
  if (res.status === 404) {
    return "Usuario no encontrado en GitHub.";
  }
  if (
    res.status === 403 &&
    res.headers.get("x-ratelimit-remaining") === "0"
  ) {
    return "Límite de peticiones de GitHub alcanzado. Añade un token o espera un momento.";
  }
  let detail = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body?.message) detail = body.message;
  } catch {
    /* ignore parse errors */
  }
  return `GitHub: ${detail}`;
}

function mapRepo(r: RawRepo): GitHubRepo {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    url: r.html_url,
    homepage: r.homepage && r.homepage.trim() ? r.homepage : null,
    isPrivate: r.private,
    isFork: r.fork,
    isArchived: r.archived,
    language: r.language,
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    openIssues: r.open_issues_count ?? 0,
    topics: r.topics ?? [],
    pushedAt: r.pushed_at,
    updatedAt: r.updated_at,
    defaultBranch: r.default_branch,
  };
}

/** GitHubClientPort over the REST API, with timeout, pagination and a token. */
export class GitHubRestAdapter implements GitHubClientPort {
  private async get(
    url: string,
    token: string | null,
  ): Promise<Result<Response>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: headers(token),
        signal: controller.signal,
      });
      return ok(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return err("La petición a GitHub superó el tiempo límite (15s).");
      }
      return err(e instanceof Error ? e.message : "Error de red con GitHub.");
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchProfile(
    cred: GitHubCredentials,
  ): Promise<Result<GitHubProfile>> {
    const res = await this.get(
      `${API}/users/${encodeURIComponent(cred.username)}`,
      cred.token,
    );
    if (!res.ok) return res;
    if (!res.value.ok) return err(await toError(res.value));

    const u = (await res.value.json()) as RawUser;
    return ok({
      login: u.login,
      name: u.name,
      avatarUrl: u.avatar_url,
      bio: u.bio,
      htmlUrl: u.html_url,
      publicRepos: u.public_repos ?? 0,
      followers: u.followers ?? 0,
      following: u.following ?? 0,
      company: u.company,
      location: u.location,
      blog: u.blog && u.blog.trim() ? u.blog : null,
    });
  }

  async fetchRepos(cred: GitHubCredentials): Promise<Result<GitHubRepo[]>> {
    // With a token we can list the authenticated user's repos (public + private,
    // owned + collaborations). Without one we fall back to the public repos of
    // the given username.
    const base = cred.token
      ? `${API}/user/repos?per_page=${PER_PAGE}&sort=pushed&affiliation=owner,collaborator,organization_member`
      : `${API}/users/${encodeURIComponent(cred.username)}/repos?per_page=${PER_PAGE}&sort=pushed&type=owner`;

    const all: GitHubRepo[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await this.get(`${base}&page=${page}`, cred.token);
      if (!res.ok) return res;
      if (!res.value.ok) return err(await toError(res.value));

      const batch = (await res.value.json()) as RawRepo[];
      all.push(...batch.map(mapRepo));
      if (batch.length < PER_PAGE) break; // last page reached
    }
    return ok(all);
  }
}
