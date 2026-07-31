/**
 * Deterministic Dockerfile + docker-compose generation from a StackDetection.
 * Pure string templating — testable and side-effect free. Templates aim for a
 * sensible, working default per stack; the user can edit before deploying.
 */
import type { DatabaseType, StackDetection } from "./detect";

function nodeImage(version: string | null): string {
  // Pull the major from an engines range like ">=20" or "20.x"; default 20.
  const m = (version ?? "").match(/(\d{2})/);
  const major = m ? m[1] : "20";
  return `node:${major}-slim`;
}

function pmInstall(pm: string | null): { enable: string; install: string } {
  switch (pm) {
    case "pnpm":
      return { enable: "RUN corepack enable", install: "pnpm install --frozen-lockfile" };
    case "yarn":
      return { enable: "RUN corepack enable", install: "yarn install --frozen-lockfile" };
    case "bun":
      return { enable: "", install: "bun install" };
    default:
      return { enable: "", install: "npm ci" };
  }
}

function pmRun(pm: string | null, script: string): string {
  if (pm === "bun") return `bun run ${script}`;
  if (pm === "yarn") return `yarn ${script}`;
  if (pm === "pnpm") return `pnpm ${script}`;
  return `npm run ${script}`;
}

/** Generate a Dockerfile tailored to the detected stack. */
export function generateDockerfile(d: StackDetection): string {
  switch (d.runtime) {
    case "node":
      return d.isStatic ? nodeStaticDockerfile(d) : nodeServerDockerfile(d);
    case "python":
      return pythonDockerfile(d);
    case "go":
      return goDockerfile(d);
    case "php":
      return phpDockerfile(d);
    case "ruby":
      return rubyDockerfile(d);
    case "java":
      return javaDockerfile(d);
    case "static":
      return staticDockerfile();
    default:
      return genericDockerfile(d);
  }
}

function rubyDockerfile(d: StackDetection): string {
  const build = d.buildCommand ? `RUN ${d.buildCommand}` : "";
  const start = d.startCommand ?? "bundle exec rackup -o 0.0.0.0 -p 3000";
  return `# Generado por Lab · ${d.framework ?? "ruby"}
FROM ruby:3.3-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \\
  && rm -rf /var/lib/apt/lists/*
COPY Gemfile Gemfile.lock* ./
RUN bundle install
COPY . .
${build}
EXPOSE ${d.port}
CMD ${cmdArray(start)}
`;
}

function javaDockerfile(d: StackDetection): string {
  const gradle = d.packageManager === "gradle";
  const buildStage = gradle
    ? `FROM gradle:8-jdk21 AS build
WORKDIR /app
COPY . .
RUN gradle build -x test --no-daemon`
    : `FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY . .
RUN mvn -q package -DskipTests`;
  const artifact = gradle ? "build/libs/*.jar" : "target/*.jar";
  return `# Generado por Lab · java (${gradle ? "gradle" : "maven"})
${buildStage}

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/${artifact} app.jar
EXPOSE ${d.port}
CMD ["java", "-jar", "app.jar"]
`;
}

function nodeServerDockerfile(d: StackDetection): string {
  const img = nodeImage(d.runtimeVersion);
  const { enable, install } = pmInstall(d.packageManager);
  const build = d.buildCommand ? `RUN ${pmRun(d.packageManager, "build")}` : "# (sin build)";
  const start = d.startCommand ?? pmRun(d.packageManager, "start");
  return `# Generado por Lab · ${d.framework ?? "node"}
FROM ${img} AS build
WORKDIR /app
${enable}
COPY package*.json ./
RUN ${install}
COPY . .
${build}

FROM ${img}
WORKDIR /app
ENV NODE_ENV=production
${enable}
COPY --from=build /app ./
EXPOSE ${d.port}
CMD ${cmdArray(start)}
`;
}

function nodeStaticDockerfile(d: StackDetection): string {
  const img = nodeImage(d.runtimeVersion);
  const { enable, install } = pmInstall(d.packageManager);
  const dir = d.publishDir ?? "dist";
  return `# Generado por Lab · ${d.framework ?? "static"} (build estático servido con nginx)
FROM ${img} AS build
WORKDIR /app
${enable}
COPY package*.json ./
RUN ${install}
COPY . .
RUN ${pmRun(d.packageManager, "build")}

FROM nginx:alpine
COPY --from=build /app/${dir} /usr/share/nginx/html
EXPOSE 80
`;
}

function pythonDockerfile(d: StackDetection): string {
  const install =
    d.packageManager === "poetry"
      ? "RUN pip install poetry && poetry config virtualenvs.create false && poetry install --no-root --no-dev"
      : "RUN pip install --no-cache-dir -r requirements.txt";
  const copyDeps =
    d.packageManager === "poetry" ? "COPY pyproject.toml poetry.lock* ./" : "COPY requirements.txt ./";
  const build = d.buildCommand ? `RUN ${d.buildCommand}` : "";
  const start = d.startCommand ?? "python main.py";
  return `# Generado por Lab · ${d.framework ?? "python"}
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
${copyDeps}
${install}
COPY . .
${build}
EXPOSE ${d.port}
CMD ${cmdArray(start)}
`;
}

function goDockerfile(d: StackDetection): string {
  return `# Generado por Lab · go
FROM golang:1.23 AS build
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./...

FROM gcr.io/distroless/static-debian12
COPY --from=build /server /server
EXPOSE ${d.port}
CMD ["/server"]
`;
}

function phpDockerfile(d: StackDetection): string {
  const start = d.startCommand ?? "php -S 0.0.0.0:8000 -t public";
  return `# Generado por Lab · ${d.framework ?? "php"}
FROM php:8.3-cli
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends unzip libpq-dev \\
  && docker-php-ext-install pdo pdo_pgsql \\
  && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock* ./
RUN composer install --no-dev --optimize-autoloader --no-scripts
COPY . .
EXPOSE ${d.port}
CMD ${cmdArray(start)}
`;
}

function staticDockerfile(): string {
  return `# Generado por Lab · sitio estático
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
`;
}

function genericDockerfile(d: StackDetection): string {
  return `# Generado por Lab · genérico (revísalo)
FROM debian:stable-slim
WORKDIR /app
COPY . .
EXPOSE ${d.port}
# TODO: define install/build/start para tu stack
CMD ["sleep", "infinity"]
`;
}

/** Render a shell command string as a JSON exec-form CMD array. */
function cmdArray(command: string): string {
  const parts = command.trim().split(/\s+/);
  return `[${parts.map((p) => JSON.stringify(p)).join(", ")}]`;
}

const DB_IMAGE: Record<Exclude<DatabaseType, null>, { image: string; port: number; env: string }> = {
  postgresql: {
    image: "postgres:16-alpine",
    port: 5432,
    env: `      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app`,
  },
  mysql: {
    image: "mysql:8",
    port: 3306,
    env: `      MYSQL_ROOT_PASSWORD: app
      MYSQL_DATABASE: app
      MYSQL_USER: app
      MYSQL_PASSWORD: app`,
  },
  mongodb: { image: "mongo:7", port: 27017, env: "" },
  redis: { image: "redis:7-alpine", port: 6379, env: "" },
};

function databaseUrl(db: Exclude<DatabaseType, null>): string {
  switch (db) {
    case "postgresql":
      return "postgresql://app:app@db:5432/app";
    case "mysql":
      return "mysql://app:app@db:3306/app";
    case "mongodb":
      return "mongodb://db:27017/app";
    case "redis":
      return "redis://db:6379";
  }
}

/**
 * Standalone docker-compose for a single database engine, using Coolify's magic
 * environment variables (SERVICE_*) so it auto-generates the credentials — the
 * same way Coolify's one-click databases work. Use it to create a compose-based
 * service in Coolify.
 */
export function databaseComposeTemplate(type: string): string {
  switch (type) {
    case "postgresql":
      return `services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${SERVICE_USER_POSTGRES:-app}
      POSTGRES_PASSWORD: \${SERVICE_PASSWORD_POSTGRES}
      POSTGRES_DB: \${POSTGRES_DB:-app}
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      timeout: 5s
      retries: 5
volumes:
  pg-data:
`;
    case "mysql":
    case "mariadb":
      return `services:
  ${type === "mariadb" ? "mariadb" : "mysql"}:
    image: ${type === "mariadb" ? "mariadb:11" : "mysql:8"}
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: \${SERVICE_PASSWORD_MYSQLROOT}
      MYSQL_DATABASE: \${MYSQL_DATABASE:-app}
      MYSQL_USER: \${SERVICE_USER_MYSQL:-app}
      MYSQL_PASSWORD: \${SERVICE_PASSWORD_MYSQL}
    volumes:
      - db-data:/var/lib/mysql
volumes:
  db-data:
`;
    case "mongodb":
      return `services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: \${SERVICE_USER_MONGO:-app}
      MONGO_INITDB_ROOT_PASSWORD: \${SERVICE_PASSWORD_MONGO}
    volumes:
      - mongo-data:/data/db
volumes:
  mongo-data:
`;
    case "redis":
      return `services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--requirepass", "\${SERVICE_PASSWORD_REDIS}"]
    volumes:
      - redis-data:/data
volumes:
  redis-data:
`;
    default:
      return `services:
  app:
    image: nginx:alpine
    restart: unless-stopped
`;
  }
}

/**
 * Generate a docker-compose that runs the app plus its database, when one was
 * detected. Returns null if no database is needed (a plain Dockerfile suffices).
 */
export function generateCompose(d: StackDetection): string | null {
  if (!d.needsDatabase || !d.databaseType) return null;
  const db = DB_IMAGE[d.databaseType];
  const envBlock = db.env ? `\n    environment:\n${db.env}` : "";
  return `# Generado por Lab · app + ${d.databaseType}
services:
  app:
    build: .
    restart: unless-stopped
    environment:
      DATABASE_URL: ${databaseUrl(d.databaseType)}
    ports:
      - "${d.port}:${d.port}"
    depends_on:
      - db

  db:
    image: ${db.image}
    restart: unless-stopped${envBlock}
    volumes:
      - db-data:/var/lib/${d.databaseType === "postgresql" ? "postgresql/data" : d.databaseType === "mysql" ? "mysql" : "data"}

volumes:
  db-data:
`;
}
