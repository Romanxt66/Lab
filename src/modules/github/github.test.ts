import { describe, it, expect } from "vitest";
import { ok, type Result } from "@/shared/kernel/result";
import {
  sortRepos,
  filterRepos,
  type GitHubRepo,
  type GitHubProfile,
} from "./domain/repo";
import { validateUsername, normaliseToken } from "./domain/config";
import { GitHubService } from "./application/github-service";
import type {
  GitHubClientPort,
  GitHubConfigRepoPort,
  GitHubCredentials,
} from "./application/ports";
import type { GitHubConfig } from "./domain/config";

function repo(p: Partial<GitHubRepo> & { id: number; name: string }): GitHubRepo {
  return {
    fullName: `me/${p.name}`,
    description: null,
    url: `https://github.com/me/${p.name}`,
    homepage: null,
    isPrivate: false,
    isFork: false,
    isArchived: false,
    language: null,
    stars: 0,
    forks: 0,
    openIssues: 0,
    topics: [],
    pushedAt: null,
    updatedAt: null,
    defaultBranch: "main",
    ...p,
  };
}

const A = repo({ id: 1, name: "alpha", stars: 3, pushedAt: "2024-01-01T00:00:00Z" });
const B = repo({ id: 2, name: "bravo", stars: 10, pushedAt: "2024-06-01T00:00:00Z" });
const C = repo({
  id: 3,
  name: "charlie",
  stars: 1,
  pushedAt: "2025-01-01T00:00:00Z",
  isFork: true,
  topics: ["cli", "rust"],
  description: "A little tool",
});

describe("sortRepos", () => {
  it("orders by most recent push", () => {
    expect(sortRepos([A, B, C], "recent").map((r) => r.id)).toEqual([3, 2, 1]);
  });
  it("orders by stars desc", () => {
    expect(sortRepos([A, B, C], "stars").map((r) => r.id)).toEqual([2, 1, 3]);
  });
  it("orders by name asc", () => {
    expect(sortRepos([C, A, B], "name").map((r) => r.name)).toEqual([
      "alpha",
      "bravo",
      "charlie",
    ]);
  });
  it("does not mutate the input", () => {
    const input = [A, B, C];
    sortRepos(input, "stars");
    expect(input.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

describe("filterRepos", () => {
  it("excludes forks when asked", () => {
    expect(
      filterRepos([A, B, C], { includeForks: false }).map((r) => r.id),
    ).toEqual([1, 2]);
  });
  it("matches query against name, description and topics", () => {
    expect(filterRepos([A, B, C], { query: "rust" }).map((r) => r.id)).toEqual([
      3,
    ]);
    expect(filterRepos([A, B, C], { query: "little" }).map((r) => r.id)).toEqual(
      [3],
    );
    expect(filterRepos([A, B, C], { query: "brav" }).map((r) => r.id)).toEqual([
      2,
    ]);
  });
  it("returns all when no filters", () => {
    expect(filterRepos([A, B, C], {})).toHaveLength(3);
  });
});

describe("validateUsername", () => {
  it("accepts valid handles", () => {
    expect(validateUsername("octocat").ok).toBe(true);
    expect(validateUsername("a-b-c").ok).toBe(true);
    const trimmed = validateUsername("  torvalds  ");
    expect(trimmed.ok && trimmed.value).toBe("torvalds");
  });
  it("rejects invalid handles", () => {
    expect(validateUsername("").ok).toBe(false);
    expect(validateUsername("-lead").ok).toBe(false);
    expect(validateUsername("trail-").ok).toBe(false);
    expect(validateUsername("has space").ok).toBe(false);
    expect(validateUsername("a".repeat(40)).ok).toBe(false);
  });
});

describe("normaliseToken", () => {
  it("trims and empties to null", () => {
    expect(normaliseToken("  ghp_x  ")).toBe("ghp_x");
    expect(normaliseToken("   ")).toBeNull();
  });
});

// --- Service with fakes ----------------------------------------------------

class FakeConfigRepo implements GitHubConfigRepoPort {
  constructor(private active: GitHubConfig | null = null) {}
  async getActive(): Promise<GitHubConfig | null> {
    return this.active;
  }
  async upsert(input: {
    username: string;
    token: string | null;
  }): Promise<GitHubConfig> {
    this.active = {
      id: "cfg-1",
      username: input.username,
      token: input.token,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.active;
  }
  async remove(): Promise<void> {
    this.active = null;
  }
}

class FakeClient implements GitHubClientPort {
  public lastCred: GitHubCredentials | null = null;
  constructor(
    private profile: GitHubProfile,
    private reposList: GitHubRepo[],
  ) {}
  async fetchProfile(cred: GitHubCredentials): Promise<Result<GitHubProfile>> {
    this.lastCred = cred;
    return ok(this.profile);
  }
  async fetchRepos(cred: GitHubCredentials): Promise<Result<GitHubRepo[]>> {
    this.lastCred = cred;
    return ok(this.reposList);
  }
}

const PROFILE: GitHubProfile = {
  login: "me",
  name: "Me",
  avatarUrl: "https://avatars/me.png",
  bio: null,
  htmlUrl: "https://github.com/me",
  publicRepos: 2,
  followers: 5,
  following: 1,
  company: null,
  location: null,
  blog: null,
};

describe("GitHubService", () => {
  it("errors on overview when not configured", async () => {
    const svc = new GitHubService(
      new FakeConfigRepo(null),
      new FakeClient(PROFILE, []),
    );
    const res = await svc.overview();
    expect(res.ok).toBe(false);
  });

  it("saves config then returns overview with those credentials", async () => {
    const repoRepo = new FakeConfigRepo(null);
    const client = new FakeClient(PROFILE, [A, B]);
    const svc = new GitHubService(repoRepo, client);

    const saved = await svc.saveConfig({ username: "me", token: "ghp_secret" });
    expect(saved.ok && saved.value.hasToken).toBe(true);
    // DTO never leaks the token itself.
    expect(saved.ok && "token" in saved.value).toBe(false);

    const res = await svc.overview();
    expect(res.ok).toBe(true);
    expect(res.ok && res.value.repos).toHaveLength(2);
    expect(client.lastCred?.token).toBe("ghp_secret");
  });

  it("rejects an invalid username on save", async () => {
    const svc = new GitHubService(
      new FakeConfigRepo(null),
      new FakeClient(PROFILE, []),
    );
    const res = await svc.saveConfig({ username: "-nope", token: "" });
    expect(res.ok).toBe(false);
  });
});
