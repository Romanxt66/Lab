import { type Result, ok } from "@/shared/kernel/result";
import { detectStack, type StackDetection } from "@/modules/deploygen/domain/detect";
import {
  generateDockerfile,
  generateCompose,
} from "@/modules/deploygen/domain/generate";
import type { RepoFetcherPort } from "./ports";

export interface AnalyzeResult {
  owner: string;
  repo: string;
  branch: string;
  /** Subfolder analyzed (for monorepos); "" = repo root. */
  baseDir: string;
  detection: StackDetection;
  dockerfile: string;
  compose: string | null;
}

/**
 * Analyzes a repository: fetches its manifest files, detects the stack and
 * generates a Dockerfile (+ compose when a database is detected). Deterministic
 * given the repo contents.
 */
export class DeploygenService {
  constructor(
    private readonly fetcher: RepoFetcherPort,
    /** Resolves an optional GitHub token (private repos + higher rate limit). */
    private readonly getToken: () => Promise<string | null>,
  ) {}

  async analyze(
    repoUrl: string,
    branch: string | null,
    subdir = "",
  ): Promise<Result<AnalyzeResult>> {
    const token = await this.getToken();
    const fetched = await this.fetcher.fetchRepoFiles(
      repoUrl,
      branch,
      subdir,
      token,
    );
    if (!fetched.ok) return fetched;

    const detection = detectStack(fetched.value.files);
    return ok({
      owner: fetched.value.owner,
      repo: fetched.value.repo,
      branch: fetched.value.branch,
      baseDir: subdir.trim().replace(/^\/+|\/+$/g, ""),
      detection,
      dockerfile: generateDockerfile(detection),
      compose: generateCompose(detection),
    });
  }
}
