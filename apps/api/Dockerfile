# Built with the repository root as context:
#   docker build -f apps/api/Dockerfile --build-arg APP_VERSION=<sha> .
# (deploy-api-skeleton design decision 5)

FROM node:24.22.2-trixie-slim@sha256:54f84b4cf8432b21aaffd5d3ce8d41e12cea0d10d33c09d2f3c9879d49d6b446 AS build
WORKDIR /workspace
ENV NX_DAEMON=false NX_NO_CLOUD=true
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm nx build api
RUN pnpm deploy --filter api --prod /deploy

FROM node:24.22.2-trixie-slim@sha256:54f84b4cf8432b21aaffd5d3ce8d41e12cea0d10d33c09d2f3c9879d49d6b446
ARG APP_VERSION=
ENV NODE_ENV=production APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=build --chown=root:root /deploy /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.status === 200 ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
