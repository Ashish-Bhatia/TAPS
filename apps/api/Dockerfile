# syntax=docker/dockerfile:1
#
# Multi-stage build for apps/api (NestJS).
#
# This is an npm-workspaces monorepo with a single root lockfile, so the
# BUILD CONTEXT MUST BE THE REPO ROOT (not apps/api/), e.g. from the repo
# root:
#   docker build -f apps/api/Dockerfile -t taps-api .
# `fly deploy` needs the same: see docs/runbooks/deploy-api.md.

FROM node:24-slim AS deps
WORKDIR /app
# Copy just the manifests every workspace needs to resolve (`npm ci`
# validates the full workspace list against package-lock.json), so this
# layer stays cached until a package.json or the lockfile actually changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
# --ignore-scripts: skip the root "prepare" (husky) lifecycle script, which
# assumes a git working tree that doesn't exist in this build context.
RUN npm ci --ignore-scripts

FROM deps AS build
COPY apps/api ./apps/api
# --ignore-scripts above skipped apps/api's "postinstall" (`prisma generate`),
# so run it explicitly before compiling — the build needs the generated
# client's types.
RUN npm run postinstall --workspace=api
RUN npm run build --workspace=api

# Separate, production-only install so the runtime image doesn't carry
# web/mobile's dependencies or any devDependencies. `prisma` (the CLI, not
# just `@prisma/client`) is a regular dependency here — TAPS-2.6 wires
# `prisma migrate deploy` into fly.toml's release_command, which Fly runs
# against this same runtime image, so the CLI must be present in it. See
# docs/adr/020-migrate-deploy-release-command.md for the trade-off this
# reintroduces (the prisma CLI's deepmerge-ts advisory now reaches the
# production image, where previously it was devDependency-only).
FROM node:24-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
RUN npm ci --workspace=api --omit=dev --ignore-scripts

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/api
COPY --from=prod-deps /app/node_modules ./node_modules
# prod-deps installed @prisma/client (and now `prisma`) with scripts
# skipped, so it has no generated engine/types — bring those in from the
# build stage, which ran `prisma generate` above.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/apps/api/dist ./dist
COPY apps/api/package.json ./package.json
# schema.prisma + prisma/migrations — needed at runtime (not just build
# time) so the release_command's `prisma migrate deploy` (fly.toml) can
# find the datasource config and the migrations to apply. No engine
# binaries live here (those came from node_modules/.prisma above).
COPY apps/api/prisma ./prisma

EXPOSE 8080
CMD ["node", "dist/main.js"]
