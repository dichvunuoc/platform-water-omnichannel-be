# ── Build Stage ──────────────────────────────────────────────────────────────
# Bun --compile KHÔNG hoạt động với @nestjs/websockets (tslib transitive dep).
# Fix: dùng node:20-slim + nest build + tsconfig-paths/register.
FROM node:20-slim AS builder

WORKDIR /app

# bun cho install (khớp bun.lock — packageManager=bun; package-lock.json đã stale),
# node cho runtime (bun --compile vỡ @nestjs/websockets).
RUN npm install -g bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN npx nest build

# ── Final Stage ──────────────────────────────────────────────────────────────
FROM node:20-slim

# Non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -s /bin/bash nodejs

WORKDIR /app

# node_modules copy nguyên từ builder (bun install đã có tsconfig-paths + drizzle-kit + tất cả deps).
# KHÔNG chạy `npm install ... --omit=dev` ở đây — nó PRUNE devDeps (drizzle-kit) → initContainer migrate fail.
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Proto file cho NotificationGrpcAdapter (load runtime từ /app/src/libs/shared/proto/notification.proto).
COPY --from=builder --chown=nodejs:nodejs /app/src/libs/shared/proto ./src/libs/shared/proto

# Migrations + drizzle config cho initContainer "migrate" (npx drizzle-kit migrate).
COPY --from=builder --chown=nodejs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nodejs:nodejs /app/drizzle.config.ts ./drizzle.config.ts

USER nodejs

EXPOSE 4001

ENV NODE_ENV=production
ENV PORT=4001

CMD ["node", "-r", "tsconfig-paths/register", "dist/src/main.js"]
