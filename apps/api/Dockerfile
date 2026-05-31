FROM node:18-alpine AS base
RUN apk add --no-cache curl
WORKDIR /app

# Copy monorepo package files for layer caching
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/qms-agent/package.json packages/qms-agent/package.json

# Install all workspace dependencies (postinstall builds shared)
RUN npm ci

# Copy source code
COPY apps/api apps/api
COPY packages/shared packages/shared

# Generate Prisma client and build TypeScript
RUN npm run build -w apps/api
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

CMD npx prisma db push --schema=apps/api/prisma/schema.prisma --accept-data-loss && node apps/api/dist/index.js
