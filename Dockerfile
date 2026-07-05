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

EXPOSE 3000

# On start: create/sync our tables in the (shared) database via `db push`
# (never migrate — other projects' tables are left untouched), then serve.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start"]
