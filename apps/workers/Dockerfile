# syntax=docker/dockerfile:1.7
# docker build -f apps/workers/Dockerfile -t armyx/workers .
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/workers/package.json apps/workers/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @armyx/workers...
COPY packages/shared packages/shared
COPY apps/workers apps/workers
RUN pnpm --filter @armyx/shared build && pnpm --filter @armyx/workers build \
 && pnpm --filter @armyx/workers deploy --prod --legacy /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 9465
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--max-old-space-size=1024", "dist/main.js"]
