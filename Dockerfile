# syntax=docker.io/docker/dockerfile:1

FROM node:23 AS front-base

# Install dependencies only when needed
FROM front-base AS front-deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM front-base AS front-builder
WORKDIR /app
COPY --from=front-deps /app/node_modules ./node_modules
# TODO: only copy the necessary files
COPY . . 

ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm && pnpm run build

FROM python:3.10.6-slim AS backend-base

# Install dependencies only when needed
FROM backend-base AS backend-deps
WORKDIR /app

COPY requirements.txt ./
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*
ENV BLIS_ARCH="generic"
RUN pip install -U pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# Production image, copy all the files and run next
FROM backend-deps AS runner
WORKDIR /app

ENV NODE_ENV=production
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 app
RUN adduser --system --uid 1001 mercury

# Automatically leverage output traces to reduce image size
COPY --from=front-builder --chown=app:mercury /app/dist ./dist
COPY --chown=app:mercury server.py database.py version.py ingester.py ./
COPY entrypoint.sh ./

USER mercury

EXPOSE 8000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["./entrypoint.sh"]
