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
