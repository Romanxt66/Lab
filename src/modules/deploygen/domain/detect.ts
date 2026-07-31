/**
 * Deterministic stack detection from a repository's manifest files. Pure and
 * heavily tested — no network, no side effects. Feed it the file list plus the
 * contents of a few key manifests and it infers how to build & run the project.
 */

export type Runtime =
  | "node"
  | "python"
  | "go"
  | "php"
  | "ruby"
  | "rust"
  | "java"
  | "static"
  | "unknown";

export type BuildPack = "nixpacks" | "dockerfile" | "static";

export type DatabaseType = "postgresql" | "mysql" | "mongodb" | "redis" | null;

export interface RepoFiles {
  /** All file paths in the repo (relative, forward slashes). */
  paths: string[];
  /** Contents of key files we fetched, keyed by lowercase path. */
  files: Record<string, string>;
}

export interface StackDetection {
  runtime: Runtime;
  framework: string | null;
  packageManager: string | null;
  runtimeVersion: string | null;
  installCommand: string | null;
  buildCommand: string | null;
  startCommand: string | null;
  port: number;
  isStatic: boolean;
  /** For static builds: the output directory (e.g. "dist", "build", "out"). */
  publishDir: string | null;
  needsDatabase: boolean;
  databaseType: DatabaseType;
  hasDockerfile: boolean;
  hasCompose: boolean;
  recommendedBuildPack: BuildPack;
  /** Human-readable adjustments/warnings surfaced to the user. */
  notes: string[];
}

function has(files: RepoFiles, name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower in files.files ||
    files.paths.some((p) => p.toLowerCase() === lower)
  );
}

function read(files: RepoFiles, name: string): string | null {
  return files.files[name.toLowerCase()] ?? null;
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string };
  packageManager?: string;
}

/** Detect the database engine implied by a set of dependency names. */
function detectDatabase(deps: Record<string, string>): DatabaseType {
  const names = Object.keys(deps).map((n) => n.toLowerCase());
  const any = (subs: string[]) => names.some((n) => subs.some((s) => n.includes(s)));
  if (any(["pg", "postgres", "prisma", "@prisma/client"])) return "postgresql";
  if (any(["mysql", "mysql2", "mariadb"])) return "mysql";
  if (any(["mongoose", "mongodb"])) return "mongodb";
  if (any(["redis", "ioredis"])) return "redis";
  return null;
}

function firstPort(...candidates: (string | null | undefined)[]): number | null {
  for (const c of candidates) {
    if (!c) continue;
    const m = c.match(/(?:PORT|port|-p|--port[= ]|:)\s*[:=]?\s*(\d{2,5})/);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 65535) return n;
    }
  }
  return null;
}

/** Main entry point: infer the stack from the repo's files. */
export function detectStack(files: RepoFiles): StackDetection {
  const base: StackDetection = {
    runtime: "unknown",
    framework: null,
    packageManager: null,
    runtimeVersion: null,
    installCommand: null,
    buildCommand: null,
    startCommand: null,
    port: 3000,
    isStatic: false,
    publishDir: null,
    needsDatabase: false,
    databaseType: null,
    hasDockerfile: has(files, "Dockerfile"),
    hasCompose:
      has(files, "docker-compose.yml") || has(files, "docker-compose.yaml") || has(files, "compose.yml"),
    recommendedBuildPack: "nixpacks",
    notes: [],
  };

  // --- Node ---------------------------------------------------------------
  const pkg = parseJson<PackageJson>(read(files, "package.json"));
  if (pkg) {
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const dep = (n: string) => n.toLowerCase() in Object.fromEntries(Object.keys(deps).map((k) => [k.toLowerCase(), true]));
    const scripts = pkg.scripts ?? {};

    const pm = has(files, "pnpm-lock.yaml")
      ? "pnpm"
      : has(files, "yarn.lock")
        ? "yarn"
        : has(files, "bun.lockb")
          ? "bun"
          : "npm";

    let framework: string | null = null;
    let port = 3000;
    let isStatic = false;
    let publishDir: string | null = null;

    if (dep("next")) {
      framework = "next";
      port = 3000;
    } else if (dep("nuxt")) {
      framework = "nuxt";
      port = 3000;
    } else if (dep("@nestjs/core")) {
      framework = "nestjs";
      port = 3000;
    } else if (dep("vite") && !dep("next")) {
      framework = "vite";
      isStatic = true;
      publishDir = "dist";
    } else if (dep("react-scripts")) {
      framework = "cra";
      isStatic = true;
      publishDir = "build";
    } else if (dep("express") || dep("fastify") || dep("koa") || dep("@hapi/hapi")) {
      framework = "express";
    } else if (dep("@angular/core")) {
      framework = "angular";
      isStatic = true;
      publishDir = "dist";
    } else if (dep("astro")) {
      framework = "astro";
    }

    const installCommand =
      pm === "npm" ? "npm ci" : pm === "yarn" ? "yarn install --frozen-lockfile" : pm === "pnpm" ? "pnpm install --frozen-lockfile" : "bun install";
    const buildCommand = scripts.build ? `${pm} run build` : null;
    const startCommand = scripts.start
      ? `${pm} run start`
      : scripts.serve
        ? `${pm} run serve`
        : null;

    const runtimeVersion = pkg.engines?.node ?? read(files, ".nvmrc")?.trim() ?? null;
    const dbType = detectDatabase(deps);
    const detectedPort = firstPort(scripts.start, scripts.serve) ?? port;

    return {
      ...base,
      runtime: "node",
      framework,
      packageManager: pm,
      runtimeVersion,
      installCommand,
      buildCommand,
      startCommand,
      port: detectedPort,
      isStatic,
      publishDir,
      needsDatabase: dbType !== null,
      databaseType: dbType,
      recommendedBuildPack: base.hasDockerfile ? "dockerfile" : isStatic ? "static" : "nixpacks",
      notes: buildNodeNotes(framework, startCommand, dbType),
    };
  }

  // --- Python -------------------------------------------------------------
  const pyproject = read(files, "pyproject.toml");
  const requirements = read(files, "requirements.txt");
  if (pyproject || requirements || has(files, "manage.py")) {
    const text = `${requirements ?? ""}\n${pyproject ?? ""}`.toLowerCase();
    const usesPoetry = Boolean(pyproject) && /\[tool\.poetry\]/.test(pyproject ?? "");
    const port = 8000;
    let framework: string | null = null;
    let startCommand: string | null = null;

    if (has(files, "manage.py") || text.includes("django")) {
      framework = "django";
      startCommand = "gunicorn ${DJANGO_WSGI:-app.wsgi}:application --bind 0.0.0.0:8000";
    } else if (text.includes("fastapi")) {
      framework = "fastapi";
      startCommand = "uvicorn main:app --host 0.0.0.0 --port 8000";
    } else if (text.includes("flask")) {
      framework = "flask";
      startCommand = "gunicorn app:app --bind 0.0.0.0:8000";
    } else {
      startCommand = "python main.py";
    }

    const dbType: DatabaseType = text.includes("psycopg") || text.includes("postgres")
      ? "postgresql"
      : text.includes("mysqlclient") || text.includes("pymysql")
        ? "mysql"
        : text.includes("pymongo")
          ? "mongodb"
          : text.includes("redis")
            ? "redis"
            : null;

    return {
      ...base,
      runtime: "python",
      framework,
      packageManager: usesPoetry ? "poetry" : "pip",
      runtimeVersion: null,
      installCommand: usesPoetry ? "poetry install --no-root" : "pip install -r requirements.txt",
      buildCommand: framework === "django" ? "python manage.py collectstatic --noinput" : null,
      startCommand,
      port,
      needsDatabase: dbType !== null,
      databaseType: dbType,
      recommendedBuildPack: base.hasDockerfile ? "dockerfile" : "nixpacks",
      notes: framework === "django"
        ? ["Django: define SECRET_KEY y DATABASE_URL como variables de entorno; ejecuta migraciones tras el primer deploy."]
        : [],
    };
  }

  // --- Go -----------------------------------------------------------------
  if (has(files, "go.mod")) {
    return {
      ...base,
      runtime: "go",
      framework: null,
      packageManager: "go",
      installCommand: "go mod download",
      buildCommand: "go build -o /app/server ./...",
      startCommand: "/app/server",
      port: 8080,
      recommendedBuildPack: base.hasDockerfile ? "dockerfile" : "nixpacks",
      notes: ["Go: se asume el binario principal en la raíz; ajusta el build si tu main está en cmd/."],
    };
  }

  // --- PHP / Laravel ------------------------------------------------------
  const composer = parseJson<{ require?: Record<string, string> }>(read(files, "composer.json"));
  if (composer) {
    const isLaravel = Boolean(composer.require?.["laravel/framework"]);
    return {
      ...base,
      runtime: "php",
      framework: isLaravel ? "laravel" : null,
      packageManager: "composer",
      installCommand: "composer install --no-dev --optimize-autoloader",
      buildCommand: null,
      startCommand: isLaravel ? "php artisan serve --host 0.0.0.0 --port 8000" : "php -S 0.0.0.0:8000 -t public",
      port: 8000,
      recommendedBuildPack: base.hasDockerfile ? "dockerfile" : "nixpacks",
      notes: isLaravel ? ["Laravel: define APP_KEY y DATABASE_URL; corre migraciones tras el deploy."] : [],
    };
  }

  // --- Ruby / Rails -------------------------------------------------------
  const gemfile = read(files, "Gemfile");
  if (gemfile !== null || has(files, "Gemfile")) {
    const isRails = (gemfile ?? "").toLowerCase().includes("rails");
    return {
      ...base,
      runtime: "ruby",
      framework: isRails ? "rails" : null,
      packageManager: "bundler",
      installCommand: "bundle install",
      buildCommand: isRails ? "bundle exec rake assets:precompile" : null,
      startCommand: isRails
        ? "bundle exec rails server -b 0.0.0.0 -p 3000"
        : "bundle exec rackup -o 0.0.0.0 -p 3000",
      port: 3000,
      recommendedBuildPack: base.hasDockerfile ? "dockerfile" : "nixpacks",
      notes: isRails
        ? ["Rails: define RAILS_MASTER_KEY (o SECRET_KEY_BASE) y DATABASE_URL; corre migraciones tras el deploy."]
        : [],
    };
  }

  // --- Java (Maven / Gradle) ---------------------------------------------
  if (has(files, "pom.xml") || has(files, "build.gradle") || has(files, "build.gradle.kts")) {
    const gradle = has(files, "build.gradle") || has(files, "build.gradle.kts");
    return {
      ...base,
      runtime: "java",
      framework: "spring",
      packageManager: gradle ? "gradle" : "maven",
      installCommand: null,
      buildCommand: gradle ? "./gradlew build -x test" : "mvn -q package -DskipTests",
      startCommand: "java -jar app.jar",
      port: 8080,
      recommendedBuildPack: base.hasDockerfile ? "dockerfile" : "nixpacks",
      notes: ["Java: se asume un jar ejecutable (Spring Boot); ajusta el nombre del artefacto si difiere."],
    };
  }

  // --- Static site --------------------------------------------------------
  if (has(files, "index.html") && !pkg) {
    return {
      ...base,
      runtime: "static",
      isStatic: true,
      publishDir: ".",
      recommendedBuildPack: "static",
      notes: ["Sitio estático: se sirve tal cual, sin build."],
    };
  }

  return { ...base, notes: ["No se pudo detectar el stack; revisa el Dockerfile generado."] };
}

function buildNodeNotes(
  framework: string | null,
  startCommand: string | null,
  db: DatabaseType,
): string[] {
  const notes: string[] = [];
  if (framework === "next") {
    notes.push('Next.js: para imagen mínima considera `output: "standalone"` en next.config.');
  }
  if (!startCommand && framework !== "vite" && framework !== "cra") {
    notes.push('No hay script "start"; ajusta el comando de arranque.');
  }
  if (db) {
    notes.push(`Detecté ${db}: se incluye un servicio de BD en el docker-compose y una variable DATABASE_URL.`);
  }
  return notes;
}
