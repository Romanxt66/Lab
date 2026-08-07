"use server";

import type { Result } from "@/shared/kernel/result";
import { getDeploygenService } from "@/shared/di/container";
import type { AnalyzeResult } from "@/modules/deploygen/application/deploygen-service";

export async function analyzeRepoAction(
  repoUrl: string,
  branch: string | null,
  subdir = "",
): Promise<Result<AnalyzeResult>> {
  return getDeploygenService().analyze(repoUrl, branch, subdir);
}

/** Commit a generated Dockerfile / docker-compose.yml into the repo. */
export async function commitGeneratedFileAction(input: {
  repoUrl: string;
  branch: string;
  baseDir: string;
  fileName: string;
  content: string;
}): Promise<Result<string>> {
  return getDeploygenService().commitGeneratedFile(input);
}
