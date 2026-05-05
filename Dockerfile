FROM node:24-slim AS builder

RUN npm install -g pnpm@10.30.3
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/transactional/package.json ./packages/transactional/
COPY packages/common/package.json ./packages/common/
COPY backend/package.json ./backend/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/transactional/ ./packages/transactional/
COPY packages/common/ ./packages/common/
COPY backend/ ./backend/

# Build @onecurrency/transactional — generates dist/ inside container
RUN pnpm --filter @onecurrency/transactional build

# Bundle backend + its resolved deps into a standalone directory
# pnpm deploy replaces workspace:* symlinks with real package copies
RUN pnpm deploy --legacy --filter=onecurrency-backend /app/standalone

FROM oven/bun:1.3.13-slim AS runner

WORKDIR /app

COPY --from=builder /app/standalone .
# Copy packages/common source for @/common/* tsconfig path alias resolution
# backend/tsconfig.json maps @/common/* to ../packages/common/src/*
# From /app/, that resolves to /packages/common/src/
COPY --from=builder /app/packages/common/src /packages/common/src
# Copy base tsconfig needed by backend/tsconfig.json (extends ../tsconfig.base.json)
COPY --from=builder /app/tsconfig.base.json /tsconfig.base.json

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]