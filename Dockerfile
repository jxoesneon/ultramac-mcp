# Multi-stage build for minimal image size
FROM oven/bun:1.3-alpine AS base

# Stage 1: Dependencies
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Stage 2: Builder
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install all dependencies (including dev)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Run tests
RUN bun test

# Stage 3: Production
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 ultramac && \
    adduser --system --uid 1001 ultramac

# Create log directory with proper permissions
RUN mkdir -p /home/ultramac/.ultramac-mcp/logs && \
    chown -R ultramac:ultramac /home/ultramac/.ultramac-mcp

# Copy production dependencies
COPY --from=deps --chown=ultramac:ultramac /app/node_modules ./node_modules

# Copy source code
COPY --chown=ultramac:ultramac . .

# Switch to non-root user
USER ultramac

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e "import {livenessProbe} from './src/health.ts'; const result = await livenessProbe(); process.exit(result.alive ? 0 : 1);"

# Expose HTTP port
EXPOSE 3010

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Start server
CMD ["bun", "run", "index.ts"]
