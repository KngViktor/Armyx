# syntax=docker/dockerfile:1.7
# docker build -f apps/web/Dockerfile -t armyx/web \
#   --build-arg NEXT_PUBLIC_SITE_URL=https://army.mil.ng \
#   --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=... \
#   --build-arg NEXT_PUBLIC_UPLOAD_ORIGIN=https://uploads.army.mil.ng \
#   --build-arg CMS_URL=http://cms.armyx.svc.cluster.local:3001 .
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_TURNSTILE_SITE_KEY NEXT_PUBLIC_UPLOAD_ORIGIN NEXT_PUBLIC_API_BASE=/api/v1 CMS_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_UPLOAD_ORIGIN=$NEXT_PUBLIC_UPLOAD_ORIGIN NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE CMS_URL=$CMS_URL
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @armyx/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @armyx/shared build && pnpm --filter @armyx/web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
