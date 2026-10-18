# Built with the repository root as context:
#   docker build -f apps/api/Dockerfile --build-arg APP_VERSION=<sha> .
# (deploy-api-skeleton design decision 5)

FROM node:24.22.0-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315 AS build
WORKDIR /workspace
ENV NX_DAEMON=false NX_NO_CLOUD=true
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm nx build api
RUN pnpm deploy --filter api --prod /deploy

FROM node:24.22.0-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315
ARG APP_VERSION=
ENV NODE_ENV=production APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=build --chown=root:root /deploy /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.status === 200 ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
