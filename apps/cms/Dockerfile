# syntax=docker/dockerfile:1.7
# docker build -f apps/cms/Dockerfile -t armyx/cms .
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/cms/package.json apps/cms/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @armyx/cms...
COPY packages/shared packages/shared
COPY apps/cms apps/cms
# PAYLOAD_SECRET / CMS_DATABASE_URL are only needed at runtime; placeholders let `next build` load the config.
RUN pnpm --filter @armyx/shared build && PAYLOAD_SECRET=build-only CMS_DATABASE_URL=postgres://build@localhost/build pnpm --filter @armyx/cms build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
RUN apk add --no-cache tini libc6-compat
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/cms/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/cms/.next/static ./apps/cms/.next/static
USER node
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/cms/server.js"]
