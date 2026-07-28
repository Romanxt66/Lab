"use client";

import {
  Star,
  GitFork,
  Lock,
  Archive,
  ExternalLink,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitHubRepo } from "@/modules/github/domain/repo";
import { relativeTime } from "./relative-time";

/** A handful of well-known language accent colours; everything else is neutral. */
const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Vue: "#41b883",
  Svelte: "#ff3e00",
};

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RepoCard({ repo }: { repo: GitHubRepo }) {
  const langColor = repo.language
    ? (LANG_COLOR[repo.language] ?? "#8b8b8b")
    : null;

  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noreferrer noopener"
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
    >
      <article
        className={cn(
          "group relative flex h-full flex-col gap-3 overflow-hidden rounded-lg glass border border-border/60 p-4 shadow-sm",
          "transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:var(--ease-out)] will-change-transform",
          "hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-lg",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1.5 text-[15px] font-medium leading-tight">
            <span className="truncate">{repo.name}</span>
          </h3>
          <ExternalLink className="mt-0.5 size-3.5 shrink-0 -translate-x-1 translate-y-0.5 text-muted-foreground opacity-0 transition-[transform,opacity] duration-300 [transition-timing-function:var(--ease-out)] group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {repo.isPrivate ? (
            <Badge>
              <Lock className="size-3" />
              Privado
            </Badge>
          ) : null}
          {repo.isFork ? (
            <Badge>
              <GitFork className="size-3" />
              Fork
            </Badge>
          ) : null}
          {repo.isArchived ? (
            <Badge className="text-foreground/70">
              <Archive className="size-3" />
              Archivado
            </Badge>
          ) : null}
        </div>

        <p className="line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-muted-foreground">
          {repo.description || (
            <span className="italic opacity-70">Sin descripción.</span>
          )}
        </p>

        {repo.topics.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {repo.topics.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
          {repo.language ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: langColor ?? undefined }}
                aria-hidden
              />
              {repo.language}
            </span>
          ) : null}
          {repo.stars > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5" />
              {repo.stars}
            </span>
          ) : null}
          {repo.forks > 0 ? (
            <span className="inline-flex items-center gap-1">
              <GitFork className="size-3.5" />
              {repo.forks}
            </span>
          ) : null}
          {repo.openIssues > 0 ? (
            <span className="inline-flex items-center gap-1">
              <CircleDot className="size-3.5" />
              {repo.openIssues}
            </span>
          ) : null}
          <span className="ml-auto whitespace-nowrap">
            {relativeTime(repo.pushedAt)}
          </span>
        </div>
      </article>
    </a>
  );
}
