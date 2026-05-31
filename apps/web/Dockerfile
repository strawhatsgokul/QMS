FROM node:18-alpine AS base
RUN apk add --no-cache curl
WORKDIR /app

# Copy monorepo package files for layer caching
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/qms-agent/package.json packages/qms-agent/package.json

# Install all workspace dependencies (postinstall builds shared)
RUN npm ci

# Copy source code
COPY apps/web apps/web
COPY packages/shared packages/shared

# Build Next.js (standalone output)
RUN npm run build -w apps/web

EXPOSE 3000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD npm start
