"use server";

import type { Result } from "@/shared/kernel/result";
import { getGitHubService } from "@/shared/di/container";
import type { GitHubConfigDTO } from "@/modules/github/domain/config";
import type { RepoOverview } from "@/modules/github/application/github-service";

/** Entry adapters for the GitHub module. */

export async function getGitHubConfigAction(): Promise<GitHubConfigDTO | null> {
  return getGitHubService().getConfig();
}

export async function saveGitHubConfigAction(input: {
  username: string;
  token: string;
}): Promise<Result<GitHubConfigDTO>> {
  return getGitHubService().saveConfig(input);
}

export async function deleteGitHubConfigAction(id: string): Promise<void> {
  await getGitHubService().deleteConfig(id);
}

export async function getGitHubOverviewAction(): Promise<Result<RepoOverview>> {
  return getGitHubService().overview();
}
