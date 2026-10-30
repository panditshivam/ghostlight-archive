FROM node:22.22.1-bookworm-slim
ARG TARGETARCH=amd64
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN set -eu; case "$TARGETARCH" in amd64) digest=09a0326a51db84d02735e53542b9ebd8c4758daf47482a9ab0abce15844e60d5 ;; arm64) digest=6c57c352d52fc3df34412376fd9ba6f74b7e3ace8e426e6cba8600156d36a145 ;; *) exit 1 ;; esac; curl -fL --retry 2 --max-time 120 "https://github.com/temporalio/cli/releases/download/v1.9.1/temporal_cli_1.9.1_linux_${TARGETARCH}.tar.gz" -o /tmp/temporal.tar.gz; echo "$digest  /tmp/temporal.tar.gz" | sha256sum -c -; tar -xzf /tmp/temporal.tar.gz -C /usr/local/bin temporal; rm /tmp/temporal.tar.gz
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build && mkdir -p /app/.data && chown -R node:node /app
USER node
ENV NODE_ENV=production PORT=8080 DATA_DIR=/app/.data TEMPORAL_BIN=/usr/local/bin/temporal NODE_OPTIONS=--max-old-space-size=128 MALLOC_ARENA_MAX=2
EXPOSE 8080
CMD ["node","server.mjs"]
