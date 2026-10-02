# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/api/Dockerfile -t armyx/api .
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @armyx/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @armyx/shared build && pnpm --filter @armyx/api build \
 && pnpm --filter @armyx/api deploy --prod --legacy /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production UV_THREADPOOL_SIZE=8
RUN apk add --no-cache tini && npm i -g tsx@4 --no-fund --no-audit
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000 9464
# Migrations: run as a separate Job/one-off with:  tsx scripts/migrate.ts
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:4000/api/v1/health/live || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--max-old-space-size=768", "dist/main.js"]
