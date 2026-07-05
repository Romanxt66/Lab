# syntax=docker/dockerfile:1

# --- Build stage: install all deps and build the Next.js app ---------------
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first (better layer caching). Includes devDeps, needed
# for `next build`, the Prisma CLI and the seed script.
COPY package.json package-lock.json ./
RUN npm ci

# Build the app (Prisma client is generated into src/generated/prisma).
COPY . .
RUN npx prisma generate && npm run build

# --- Runtime stage ---------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# pg is pure-JS; no native build tools needed at runtime.

# Copy the built app plus the tooling used on startup (Prisma CLI, tsx for the
# admin seed). Kept simple over a leaner standalone image on purpose.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh

EXPOSE 3000

# On start: `db push` (create/sync our tables — never migrate, so the shared
# DB's other tables are untouched), optionally seed the superadmin, then serve.
CMD ["sh", "docker-entrypoint.sh"]
