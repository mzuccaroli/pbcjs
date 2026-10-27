FROM node:22-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    HUSKY=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @pbcjs/web build \
  && pnpm --filter @pbcjs/api build \
  && pnpm --filter @pbcjs/api deploy --prod /out

FROM node:22-alpine
ARG APP_VERSION=0.0.0-dev
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    APP_VERSION=${APP_VERSION} \
    WEB_DIST_DIR=/app/public \
    MIGRATIONS_DIR=/app/drizzle
WORKDIR /app

COPY --from=build /out ./
COPY --from=build /repo/apps/web/dist ./public
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/server.js"]
