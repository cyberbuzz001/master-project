# Multi-Stage Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies (needed for native addons)
RUN apk add --no-cache python3 make g++ git

# Copy root package files and install root deps
COPY package.json package-lock.json ./
RUN npm install

# Copy client package files and install client deps fresh
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm install

# Copy source files (excluding node_modules via .dockerignore)
COPY . .

# Build backend & client
RUN npm run build:server && npm run build:client

# Production Stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install Python 3 and SmartApi dependencies for Angel One SmartConnect ticker
RUN apk add --no-cache python3 py3-pip && \
    pip install --no-cache-dir SmartApi-python websocket-client requests pyotp logzero --break-system-packages

COPY package.json package-lock.json ./
RUN npm install --only=production

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/marketData ./server/src/marketData
COPY --from=builder /app/server/src/marketData ./server/dist/marketData
COPY --from=builder /app/server/src/db/migrations ./server/src/db/migrations
COPY --from=builder /app/server/src/db/migrations ./server/dist/db/migrations
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/docs ./docs

CMD ["node", "server/dist/index.js"]
