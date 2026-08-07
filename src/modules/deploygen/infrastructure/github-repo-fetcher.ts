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
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
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

  /**
   * Create or update a file via the contents API. Requires a token with write
   * access to the repo; updating needs the current blob SHA.
   */
  async commitFile(
    repoUrl: string,
    branch: string,
    path: string,
    content: string,
    message: string,
    token: string | null,
  ): Promise<Result<string>> {
    if (!token) {
      return err(
        "Necesitas un token de GitHub con permiso de escritura (conéctalo en la herramienta GitHub).",
      );
    }
    const parsed = parseRepo(repoUrl);
    if (!parsed) return err("URL de repositorio no válida.");
    const { owner, repo } = parsed;
    const cleanPath = path.replace(/^\/+/, "");
    const apiPath = cleanPath.split("/").map(encodeURIComponent).join("/");
    const url = `${API}/repos/${owner}/${repo}/contents/${apiPath}`;

    // Existing file? We need its SHA to update it.
    const existing = await this.getJson<{ sha?: string }>(
      `${url}?ref=${encodeURIComponent(branch)}`,
      token,
    );
    if (!existing.ok) return existing;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { ...headers(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          content: Buffer.from(content, "utf8").toString("base64"),
          branch,
          ...(existing.value?.sha ? { sha: existing.value.sha } : {}),
        }),
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        return err(
          "GitHub rechazó la escritura: el token necesita permiso de escritura (scope repo / Contents: write).",
        );
      }
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) detail = body.message;
        } catch {
          /* ignore */
        }
        return err(`GitHub: ${detail}`);
      }
      return ok(
        existing.value?.sha
          ? `${cleanPath} actualizado en ${branch}.`
          : `${cleanPath} creado en ${branch}.`,
      );
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
    subdir: string,
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

    // Optional subfolder (monorepos). Normalise to "path/" or "".
    const prefix = subdir.trim().replace(/^\/+|\/+$/g, "");
    const dirPath = prefix ? `/${encodeURIComponent(prefix).replace(/%2F/g, "/")}` : "";

    // Directory listing → file paths.
    const listing = await this.getJson<{ name: string; type: string }[]>(
      `${API}/repos/${owner}/${repo}/contents${dirPath}?ref=${encodeURIComponent(ref)}`,
      token,
    );
    if (!listing.ok) return listing;
    if (!listing.value) {
      return err(prefix ? `No se encontró el directorio "${prefix}".` : "No se pudo leer el contenido del repositorio.");
    }

    const paths = listing.value.map((e) => e.name);
    const rootNames = new Set(paths.map((p) => p.toLowerCase()));

    // Fetch the contents of key manifests that exist in this directory.
    const files: Record<string, string> = {};
    for (const key of KEY_FILES) {
      if (!rootNames.has(key.toLowerCase())) continue;
      const filePath = prefix ? `${prefix}/${key}` : key;
      const file = await this.getJson<{ content?: string; encoding?: string }>(
        `${API}/repos/${owner}/${repo}/contents/${filePath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`,
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
