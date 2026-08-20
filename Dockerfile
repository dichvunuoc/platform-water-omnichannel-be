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

# ── Prod deps Stage ───────────────────────────────────────────────────────────
# Trivy fix: builder node_modules chứa TOÀN BỘ devDeps (eslint chain, @angular-devkit,
# glob/minimatch/brace-expansion...) → hàng chục CVE vào image không cần thiết.
# Stage này install CHỈ production deps (src/ không import devDep nào runtime —
# đã verify; drizzle-kit chỉ cần cho initContainer migrate — hiện đã gỡ khỏi live,
# nếu thêm lại thì dùng builder stage hoặc stage riêng).
FROM node:20-slim AS deps-prod
WORKDIR /app
RUN npm install -g bun
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

# ── Final Stage ──────────────────────────────────────────────────────────────
FROM node:20-slim

# OS CVE fix (Trivy CRITICAL/HIGH: libgnutls30 CVE-2026-33845 v.v.) —
# nâng gói debian về bản có vá; layer này là cái ship thật.
RUN apt-get update && apt-get -y upgrade && rm -rf /var/lib/apt/lists/*

# Gỡ npm khỏi image runtime (chỉ cần node): npm bundle kèm sigstore/tar/ip-address/
# minimatch/cross-spawn cũ — nguồn phần lớn CVE còn lại trong scan. App không dùng npm/npx runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -s /bin/bash nodejs

WORKDIR /app

# node_modules copy nguyên từ builder (bun install đã có tsconfig-paths + drizzle-kit + tất cả deps).
# KHÔNG chạy `npm install ... --omit=dev` ở đây — nó PRUNE devDeps (drizzle-kit) → initContainer migrate fail.
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
# Prod-only node_modules (từ deps-prod — không còn devDeps/CVE toolchain).
COPY --from=deps-prod --chown=nodejs:nodejs /app/node_modules ./node_modules

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
