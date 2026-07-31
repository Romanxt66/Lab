import type { Result } from "@/shared/kernel/result";
import type { RepoFiles } from "@/modules/deploygen/domain/detect";

/** Result of fetching a repository's manifest files. */
export interface FetchedRepo {
  owner: string;
  repo: string;
  branch: string;
  files: RepoFiles;
}

/** Reads a repository's files (used to detect the stack). */
export interface RepoFetcherPort {
  fetchRepoFiles(
    repoUrl: string,
    branch: string | null,
    /** Subfolder to analyze (for monorepos); empty = repo root. */
    subdir: string,
    token: string | null,
  ): Promise<Result<FetchedRepo>>;
}
