import { describe, it, expect } from "vitest";
import { detectStack, type RepoFiles } from "./domain/detect";
import { generateDockerfile, generateCompose } from "./domain/generate";

function repo(
  paths: string[],
  files: Record<string, string> = {},
): RepoFiles {
  // Key files are keyed lowercase (matching the detector's lookup).
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) lower[k.toLowerCase()] = v;
  return { paths, files: lower };
}

describe("detectStack · node", () => {
  it("detects Next.js with pnpm and a Postgres dependency", () => {
    const d = detectStack(
      repo(["package.json", "pnpm-lock.yaml", "next.config.js"], {
        "package.json": JSON.stringify({
          scripts: { build: "next build", start: "next start" },
          dependencies: { next: "15.0.0", "@prisma/client": "6" },
        }),
      }),
    );
    expect(d.runtime).toBe("node");
    expect(d.framework).toBe("next");
    expect(d.packageManager).toBe("pnpm");
    expect(d.buildCommand).toBe("pnpm run build");
    expect(d.startCommand).toBe("pnpm run start");
    expect(d.needsDatabase).toBe(true);
    expect(d.databaseType).toBe("postgresql");
    expect(d.recommendedBuildPack).toBe("nixpacks");
  });

  it("detects Vite as a static build", () => {
    const d = detectStack(
      repo(["package.json", "yarn.lock", "index.html"], {
        "package.json": JSON.stringify({
          scripts: { build: "vite build" },
          devDependencies: { vite: "5" },
        }),
      }),
    );
    expect(d.runtime).toBe("node");
    expect(d.framework).toBe("vite");
    expect(d.isStatic).toBe(true);
    expect(d.publishDir).toBe("dist");
    expect(d.packageManager).toBe("yarn");
    expect(d.recommendedBuildPack).toBe("static");
  });

  it("prefers a committed Dockerfile when present", () => {
    const d = detectStack(
      repo(["package.json", "Dockerfile"], {
        "package.json": JSON.stringify({
          scripts: { start: "node index.js" },
          dependencies: { express: "4" },
        }),
      }),
    );
    expect(d.hasDockerfile).toBe(true);
    expect(d.recommendedBuildPack).toBe("dockerfile");
  });
});

describe("detectStack · other runtimes", () => {
  it("detects Django", () => {
    const d = detectStack(
      repo(["manage.py", "requirements.txt"], {
        "requirements.txt": "django==5.0\npsycopg2-binary==2.9",
      }),
    );
    expect(d.runtime).toBe("python");
    expect(d.framework).toBe("django");
    expect(d.databaseType).toBe("postgresql");
    expect(d.needsDatabase).toBe(true);
  });

  it("detects Go", () => {
    const d = detectStack(repo(["go.mod", "main.go"], { "go.mod": "module x\n" }));
    expect(d.runtime).toBe("go");
    expect(d.port).toBe(8080);
  });

  it("detects Laravel", () => {
    const d = detectStack(
      repo(["composer.json", "artisan"], {
        "composer.json": JSON.stringify({ require: { "laravel/framework": "^11" } }),
      }),
    );
    expect(d.runtime).toBe("php");
    expect(d.framework).toBe("laravel");
  });

  it("detects a plain static site", () => {
    const d = detectStack(repo(["index.html", "style.css"]));
    expect(d.runtime).toBe("static");
    expect(d.recommendedBuildPack).toBe("static");
  });

  it("falls back to unknown with a note", () => {
    const d = detectStack(repo(["README.md"]));
    expect(d.runtime).toBe("unknown");
    expect(d.notes.length).toBeGreaterThan(0);
  });
});

describe("generateDockerfile", () => {
  it("produces a multi-stage Node Dockerfile with the right port and CMD", () => {
    const d = detectStack(
      repo(["package.json"], {
        "package.json": JSON.stringify({
          scripts: { build: "next build", start: "next start" },
          dependencies: { next: "15" },
        }),
      }),
    );
    const df = generateDockerfile(d);
    expect(df).toContain("FROM node:");
    expect(df).toContain("EXPOSE 3000");
    expect(df).toContain('CMD ["npm", "run", "start"]');
    expect(df).toContain("RUN npm run build");
  });

  it("uses nginx for a static build", () => {
    const d = detectStack(
      repo(["package.json"], {
        "package.json": JSON.stringify({
          scripts: { build: "vite build" },
          devDependencies: { vite: "5" },
        }),
      }),
    );
    const df = generateDockerfile(d);
    expect(df).toContain("FROM nginx:alpine");
    expect(df).toContain("/app/dist");
  });

  it("produces a Go distroless Dockerfile", () => {
    const d = detectStack(repo(["go.mod"], { "go.mod": "module x" }));
    const df = generateDockerfile(d);
    expect(df).toContain("FROM golang:");
    expect(df).toContain("distroless");
  });
});

describe("generateCompose", () => {
  it("returns null when no database is needed", () => {
    const d = detectStack(
      repo(["package.json"], {
        "package.json": JSON.stringify({ dependencies: { express: "4" } }),
      }),
    );
    expect(generateCompose(d)).toBeNull();
  });

  it("emits app + db services with a DATABASE_URL when a DB is detected", () => {
    const d = detectStack(
      repo(["package.json"], {
        "package.json": JSON.stringify({
          scripts: { start: "node index.js" },
          dependencies: { pg: "8", express: "4" },
        }),
      }),
    );
    const compose = generateCompose(d);
    expect(compose).not.toBeNull();
    expect(compose).toContain("services:");
    expect(compose).toContain("postgres:16-alpine");
    expect(compose).toContain("DATABASE_URL: postgresql://app:app@db:5432/app");
    expect(compose).toContain("db-data:");
  });
});
