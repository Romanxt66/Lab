import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import type {
  FetchedRepo,
  RepoFetcherPort,
} from "@/modules/deploygen/application/ports";
import type { RepoFiles } from "@/modules/deploygen/domain/detect";

const API = "https://api.github.com";
const TIMEOUT_MS = 15_000;

/** Manifest files we read the contents of (root-level). Everything else is
 * detected by presence in the file list. */
const KEY_FILES = [
  "package.json",
  ".nvmrc",
  "requirements.txt",
  "pyproject.toml",
  "composer.json",
  "go.mod",
];

function headers(token: string | null): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Lab-Deploygen",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Parse "owner" and "repo" from a GitHub URL or "owner/repo" shorthand. */
function parseRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  // https://github.com/owner/repo  |  github.com/owner/repo  |  owner/repo
  const m = trimmed.match(/(?:github\.com[/:])?([^/\s]+)\/([^/\s]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export class GitHubRepoFetcher implements RepoFetcherPort {
  private async getJson<T>(
    url: string,
    token: string | null,
  ): Promise<Result<T | null>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: headers(token),
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status === 404) return ok(null);
      if (res.status === 401 || res.status === 403) {
        return err(
          "GitHub rechazó la petición (¿repo privado sin token, o límite de peticiones?).",
        );
      }
      if (!res.ok) return err(`GitHub: HTTP ${res.status}`);
      return ok((await res.json()) as T);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return err("La petición a GitHub superó el tiempo límite.");
      }
      return err(e instanceof Error ? e.message : "Error de red con GitHub.");
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchRepoFiles(
    repoUrl: string,
    branch: string | null,
    token: string | null,
  ): Promise<Result<FetchedRepo>> {
    const parsed = parseRepo(repoUrl);
    if (!parsed) return err("URL de repositorio no válida (usa owner/repo o la URL de GitHub).");
    const { owner, repo } = parsed;

    // Resolve the default branch if none was given.
    let ref = branch?.trim() || "";
    if (!ref) {
      const info = await this.getJson<{ default_branch?: string }>(
        `${API}/repos/${owner}/${repo}`,
        token,
      );
      if (!info.ok) return info;
      if (!info.value) return err("Repositorio no encontrado en GitHub.");
      ref = info.value.default_branch ?? "main";
    }

    // Root listing → file paths.
    const root = await this.getJson<{ name: string; type: string }[]>(
      `${API}/repos/${owner}/${repo}/contents?ref=${encodeURIComponent(ref)}`,
      token,
    );
    if (!root.ok) return root;
    if (!root.value) return err("No se pudo leer el contenido del repositorio.");

    const paths = root.value.map((e) => e.name);
    const rootNames = new Set(paths.map((p) => p.toLowerCase()));

    // Fetch the contents of key manifests that exist at the root.
    const files: Record<string, string> = {};
    for (const key of KEY_FILES) {
      if (!rootNames.has(key.toLowerCase())) continue;
      const file = await this.getJson<{ content?: string; encoding?: string }>(
        `${API}/repos/${owner}/${repo}/contents/${encodeURIComponent(key)}?ref=${encodeURIComponent(ref)}`,
        token,
      );
      if (file.ok && file.value?.content) {
        try {
          files[key.toLowerCase()] = Buffer.from(
            file.value.content,
            "base64",
          ).toString("utf8");
        } catch {
          /* ignore decode errors */
        }
      }
    }

    const repoFiles: RepoFiles = { paths, files };
    return ok({ owner, repo, branch: ref, files: repoFiles });
  }
}
