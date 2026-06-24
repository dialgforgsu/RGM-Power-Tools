# Self-host the RGM Power Tools dashboard.
#
# The dashboard's Monitor operations shell out to PowerShell, so the runtime
# image ships PowerShell 7. You must still provide the Redgate Monitor
# PowerShell module at runtime (mount it and set PSModulePath) — it is licensed
# per Monitor instance and is not bundled here.

# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm -r build

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    wget apt-transport-https ca-certificates \
  && wget -q https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
  && dpkg -i packages-microsoft-prod.deb \
  && rm packages-microsoft-prod.deb \
  && apt-get update \
  && apt-get install -y --no-install-recommends powershell \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable
COPY --from=build /app /app

# Inside the container we bind all interfaces; the host should publish the port
# only to loopback (see docker-compose.yml). A DASHBOARD_TOKEN is required —
# the server refuses to bind a public interface without one.
ENV DASHBOARD_HOST=0.0.0.0 \
    DASHBOARD_PORT=4570 \
    RGM_WORKDIR=/data
EXPOSE 4570
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.DASHBOARD_PORT||4570)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/server/dist/cli.js"]
