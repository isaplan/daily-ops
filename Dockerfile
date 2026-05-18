# Build stage
FROM node:22.22.1-alpine AS builder

WORKDIR /app

# Install pnpm first
RUN npm install -g pnpm@10.33.0

# Copy package files only
COPY package.json pnpm-lock.yaml ./

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:22.22.1-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install pnpm
RUN npm install -g pnpm@10.33.0

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only (no devDependencies)
RUN pnpm install --prod --frozen-lockfile && \
    # Remove pnpm store to save space
    pnpm store prune

# Copy built app from builder stage
COPY --from=builder /app/.output ./.output

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Start app
CMD ["node", ".output/server/index.mjs"]
