/**
 * GitHub domain types + pure helpers. No I/O, no framework — safe to import
 * from both server (adapters/services) and client (UI) code.
 */

export type RepoSort = "recent" | "stars" | "name";

/** A repository, normalised from the GitHub REST shape. */
export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  /** Canonical web URL (html_url). */
  url: string;
  homepage: string | null;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  /** ISO timestamp of the last push, or null. Drives "recent" sorting. */
  pushedAt: string | null;
  updatedAt: string | null;
  defaultBranch: string;
}

/** The account whose repositories we're previewing. */
export interface GitHubProfile {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  htmlUrl: string;
  publicRepos: number;
  followers: number;
  following: number;
  company: string | null;
  location: string | null;
  blog: string | null;
}

function pushedTime(r: GitHubRepo): number {
  return r.pushedAt ? Date.parse(r.pushedAt) : 0;
}

/** Sort a copy of the list; the original is never mutated. */
export function sortRepos(repos: GitHubRepo[], sort: RepoSort): GitHubRepo[] {
  const copy = [...repos];
  switch (sort) {
    case "stars":
      return copy.sort(
        (a, b) => b.stars - a.stars || pushedTime(b) - pushedTime(a),
      );
    case "name":
      return copy.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    case "recent":
    default:
      return copy.sort((a, b) => pushedTime(b) - pushedTime(a));
  }
}

export interface RepoFilter {
  /** Free-text match against name, description and topics (case-insensitive). */
  query?: string;
  includeForks?: boolean;
  includeArchived?: boolean;
}

/** Apply the client-side filters. Pure; returns a new array. */
export function filterRepos(
  repos: GitHubRepo[],
  { query, includeForks = true, includeArchived = true }: RepoFilter,
): GitHubRepo[] {
  const q = query?.trim().toLowerCase();
  return repos.filter((r) => {
    if (!includeForks && r.isFork) return false;
    if (!includeArchived && r.isArchived) return false;
    if (!q) return true;
    const haystack = [r.name, r.description ?? "", ...r.topics]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
