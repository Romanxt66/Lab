import { type Result, ok, err } from "@/shared/kernel/result";
import {
  toConfigDTO,
  validateUsername,
  normaliseToken,
  type GitHubConfigDTO,
} from "@/modules/github/domain/config";
import type { GitHubProfile, GitHubRepo } from "@/modules/github/domain/repo";
import type { GitHubClientPort, GitHubConfigRepoPort } from "./ports";

export interface RepoOverview {
  profile: GitHubProfile;
  repos: GitHubRepo[];
}

/**
 * GitHub use-cases. Depends only on ports, so it's unit-testable with fakes.
 * The overview reads the stored connection, then fetches the profile and repos
 * in parallel.
 */
export class GitHubService {
  constructor(
    private readonly configRepo: GitHubConfigRepoPort,
    private readonly client: GitHubClientPort,
  ) {}

  async getConfig(): Promise<GitHubConfigDTO | null> {
    const c = await this.configRepo.getActive();
    return c ? toConfigDTO(c) : null;
  }

  async saveConfig(input: {
    username: string;
    token: string;
  }): Promise<Result<GitHubConfigDTO>> {
    const username = validateUsername(input.username);
    if (!username.ok) return username;

    const token = normaliseToken(input.token);
    const saved = await this.configRepo.upsert({
      username: username.value,
      token,
    });
    return ok(toConfigDTO(saved));
  }

  async deleteConfig(id: string): Promise<void> {
    await this.configRepo.remove(id);
  }

  async overview(): Promise<Result<RepoOverview>> {
    const config = await this.configRepo.getActive();
    if (!config) {
      return err("Configura tu usuario de GitHub para ver tus repositorios.");
    }
    const cred = { username: config.username, token: config.token };

    const [profile, repos] = await Promise.all([
      this.client.fetchProfile(cred),
      this.client.fetchRepos(cred),
    ]);
    if (!profile.ok) return profile;
    if (!repos.ok) return repos;

    return ok({ profile: profile.value, repos: repos.value });
  }
}
