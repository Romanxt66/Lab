import type { Result } from "@/shared/kernel/result";
import type { GitHubConfig } from "@/modules/github/domain/config";
import type { GitHubProfile, GitHubRepo } from "@/modules/github/domain/repo";

/** Credentials the client needs to talk to the GitHub API. */
export interface GitHubCredentials {
  username: string;
  /** null → unauthenticated (public repos only). */
  token: string | null;
}

/** Talks to the GitHub REST API. Adapters live in `infrastructure/`. */
export interface GitHubClientPort {
  fetchProfile(cred: GitHubCredentials): Promise<Result<GitHubProfile>>;
  fetchRepos(cred: GitHubCredentials): Promise<Result<GitHubRepo[]>>;
}

/** Persists the single GitHub connection config. */
export interface GitHubConfigRepoPort {
  getActive(): Promise<GitHubConfig | null>;
  upsert(input: {
    username: string;
    token: string | null;
  }): Promise<GitHubConfig>;
  remove(id: string): Promise<void>;
}
