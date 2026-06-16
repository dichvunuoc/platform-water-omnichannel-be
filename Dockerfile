# --- Build Stage ---
# Pinned Bun version (NOT :latest) — prevents breaking-change surprises in CI/CD.
# Bump intentionally when you've validated a new Bun release locally.
FROM oven/bun:1.3.14-debian AS builder

WORKDIR /app

# Copy package files and install dependencies
# `bun.lock*` glob covers both legacy binary `bun.lockb` and current text `bun.lock`
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source code and scripts
COPY . .

# Ensure the build script is executable
RUN chmod +x scripts/build-binary.sh

# Build the binary
RUN bun run build:binary

# --- CA Certs Stage ---
# Distroless ships NO CA bundle. Install ca-certificates in Debian first, then copy
# the bundle into the final stage — otherwise Bun's outbound TLS (Backend, Zalo OAuth)
# fails certificate validation in production.
FROM debian:12-slim AS certs
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- Final Stage (Distroless) ---
# Distroless: no package manager, no shell → minimal attack surface, can't `docker exec`.
# `cc-debian12` bundles glibc + libgcc + libstdc++ (the C/C++ runtime the Bun binary needs).
# `:nonroot` already runs as UID 65532 — no need to create a user or set USER.
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app

# CA bundle for outbound TLS verification
COPY --from=certs /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Copy only the compiled binary from the builder stage
COPY --from=builder /app/build/nest-app /app/nest-app

# Copy migration files — required by DatabaseMigrationService at runtime
# Bun --compile does NOT bundle external SQL files
COPY --from=builder /app/drizzle /app/drizzle

# Copy config files — required by EndpointConfigService at runtime
# api-endpoints.yaml, schemas, etc. are read at runtime, not bundled
COPY --from=builder /app/config /app/config

# Copy mock data files — required by MockAdapterBase when api-endpoints.yaml
# sets adapter: mock (the default for all CSKH ports until Backend API is live).
# MockAdapterBase reads these JSON files on-demand at runtime.
COPY --from=builder /app/mocks /app/mocks

# Copy swagger-ui-dist static assets — Bun --compile does NOT bundle
# node_modules, so NestJS Swagger's default absolute path to swagger-ui-dist
# is absent at runtime and CSS/JS assets 404. main.ts reads SWAGGER_UI_DIST
# to serve these from a known location instead.
COPY --from=builder /app/node_modules/swagger-ui-dist /app/swagger-ui-dist

# Expose the application port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
# Disable pretty logging in container to avoid pino-pretty dependency issues in binary
ENV ENABLE_PRETTY_LOGGING=false

# Run the binary — distroless:nonroot executes as UID 65532
ENTRYPOINT ["/app/nest-app"]
