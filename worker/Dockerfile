# ==============================================================================
# Sculra Autonomous QA Worker Production Dockerfile (worker/Dockerfile)
# ==============================================================================
# Multi-stage production container build for @sculra/worker.
# Build Context: Repository Root (monorepo root).
#
# Build command:
#   docker build -f worker/Dockerfile -t sculra-worker:latest .
#
# Run command:
#   docker run -p 8080:8080 \
#     -e SUPABASE_URL=https://your-project.supabase.co \
#     -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
#     sculra-worker:latest

# ------------------------------------------------------------------------------
# Stage 1: Build stage
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install compatible pnpm matching packageManager in root package.json
RUN npm install -g pnpm@9.15.4

# Copy monorepo configuration and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY worker/package.json ./worker/

# Install all dependencies (including devDependencies required for compilation)
RUN pnpm install --frozen-lockfile --filter @sculra/worker...

# Copy worker source code and TypeScript config
COPY worker/tsconfig.json ./worker/
COPY worker/src ./worker/src

# Compile TypeScript to JavaScript in worker/dist
RUN pnpm --filter @sculra/worker run build

# ------------------------------------------------------------------------------
# Stage 2: Production runtime stage
# ------------------------------------------------------------------------------
# Uses official Playwright noble image containing Playwright v1.50.1, Chromium,
# and all required OS system/graphics dependencies pre-configured.
FROM mcr.microsoft.com/playwright:v1.50.1-noble AS runner

WORKDIR /app

# Install compatible pnpm
RUN npm install -g pnpm@9.15.4

# Set production environment flags
ENV NODE_ENV=production
ENV WORKER_HEALTH_PORT=8080
ENV PORT=8080

# Copy monorepo configuration and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY worker/package.json ./worker/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter @sculra/worker...

# Copy compiled JavaScript distribution from builder stage
COPY --from=builder /app/worker/dist ./worker/dist

# Ensure app directory permissions for non-root pwuser
RUN chown -R pwuser:pwuser /app

# Switch to non-root user provided by the Playwright base image
USER pwuser

# Expose HTTP health and readiness port
EXPOSE 8080

# Container health probe checking the lightweight health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.WORKER_HEALTH_PORT || 8080) + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Deterministic production startup command
CMD ["node", "worker/dist/index.js"]
