import type { Result } from "@/shared/kernel/result";
import type { RepoFiles } from "@/modules/deploygen/domain/detect";

/** Result of fetching a repository's manifest files. */
export interface FetchedRepo {
  owner: string;
  repo: string;
  branch: string;
  files: RepoFiles;
}

/** Reads (and optionally writes) a repository's files. */
export interface RepoFetcherPort {
  fetchRepoFiles(
    repoUrl: string,
    branch: string | null,
    /** Subfolder to analyze (for monorepos); empty = repo root. */
    subdir: string,
    token: string | null,
  ): Promise<Result<FetchedRepo>>;
  /**
   * Create or update a file in the repo (needs a token with write access).
   * Used to commit a generated Dockerfile so it can be deployed with Docker.
   */
  commitFile(
    repoUrl: string,
    branch: string,
    path: string,
    content: string,
    message: string,
    token: string | null,
  ): Promise<Result<string>>;
}
