# syntax=docker/dockerfile:1.7
# STS Street production image. Builds the client bundle and workspace
# packages, generates the corresponding-source archive, and runs the Express
# server. Database migrations run from the entrypoint.
#
# The image needs no OS packages: fonts for server-side export (incl. Noto
# Sans Georgian) are registered from npm packages, and Node ships its own CA
# store. Run with `--init` (compose sets `init: true`) for PID 1 signal
# handling.

FROM node:24-bookworm-slim AS build
ENV HUSKY=0 CYPRESS_INSTALL_BINARY=0 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY client/package.json ./client/package.json
COPY docs/package.json ./docs/package.json
RUN npm ci --no-audit --no-fund
COPY . .
ARG SOURCE_COMMIT=unknown
ENV SOURCE_COMMIT=${SOURCE_COMMIT}
RUN npm run build:app \
 && bash bin/source-archive.sh \
 && rm -rf .parcel-cache

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HUSKY=0 CYPRESS_INSTALL_BINARY=0 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app
COPY --from=build --chown=node:node /app /app
# Remove dev-only files that are not needed at runtime
RUN rm -rf /app/cypress /app/test/e2e/output /app/docs/node_modules \
 && mkdir -p /app/data && chown -R node:node /app/data
ARG SOURCE_COMMIT=unknown
ENV SOURCE_COMMIT=${SOURCE_COMMIT} PORT=8000 TRUST_PROXY=true
USER node
EXPOSE 8000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/bin/docker-entrypoint.sh"]
CMD ["node", "index.ts"]
