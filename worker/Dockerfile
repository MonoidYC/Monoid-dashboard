# --- Stage 1: Build analyzer-core dependency ---
FROM node:20-slim AS analyzer-core-build

WORKDIR /analyzer-core
COPY ../Monoid-Extension/packages/analyzer-core/package*.json ./
RUN npm ci --omit=dev
COPY ../Monoid-Extension/packages/analyzer-core/ ./
RUN npm run build

# --- Stage 2: Build worker ---
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy analyzer-core built output
COPY --from=analyzer-core-build /analyzer-core /analyzer-core

# Install worker dependencies
COPY package*.json ./
# Repoint analyzer-core to the built copy
RUN sed -i 's|file:../../Monoid-Extension/packages/analyzer-core|file:/analyzer-core|' package.json
RUN npm ci

# Copy worker source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# --- Stage 3: Runtime ---
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /analyzer-core /analyzer-core
COPY --from=builder /app/package*.json ./
RUN sed -i 's|file:../../Monoid-Extension/packages/analyzer-core|file:/analyzer-core|' package.json
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
