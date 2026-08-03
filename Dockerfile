# ── Build Stage ──────────────────────────────────────────────────────────────
# Bun --compile KHÔNG hoạt động với @nestjs/websockets (tslib transitive dep).
# Fix: dùng node:20-slim + nest build + tsconfig-paths/register.
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN npm install --frozen-lockfile

COPY . .
RUN npx nest build

# ── Final Stage ──────────────────────────────────────────────────────────────
FROM node:20-slim

# Non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -s /bin/bash nodejs

WORKDIR /app

# Install runtime deps (tsconfig-paths for path aliases at runtime)
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
RUN npm install tsconfig-paths --omit=dev

USER nodejs

EXPOSE 4001

ENV NODE_ENV=production
ENV PORT=4001

CMD ["node", "-r", "tsconfig-paths/register", "dist/src/main.js"]
