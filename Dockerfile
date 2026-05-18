# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install pnpm first
RUN npm install -g pnpm@10.33.0

# Copy package files only
COPY package.json pnpm-lock.yaml ./

# Install dependencies with frozen lockfile
RUN echo "Installing dependencies..." && \
    pnpm install --frozen-lockfile && \
    echo "Dependencies installed successfully"

# Copy source code
COPY . .

# Build the application
RUN echo "Starting build..." && \
    pnpm run build && \
    echo "Build completed successfully"

# Production stage
FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install pnpm
RUN npm install -g pnpm@10.33.0

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only (no devDependencies)
RUN echo "Installing production dependencies..." && \
    pnpm install --prod --frozen-lockfile && \
    pnpm store prune && \
    echo "Production dependencies installed"

# Copy built app from builder stage
COPY --from=builder /app/.output ./.output

# Remove node_modules from .output (should not be bundled)
RUN rm -rf ./.output/server/node_modules

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Start app
CMD ["node", ".output/server/index.mjs"]
