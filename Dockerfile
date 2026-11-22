# syntax=docker/dockerfile:1

# --- Install dependencies (production only) --------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- Runtime image ---------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

# Don't run as root (UID 1000 = user "node" in the official image).
# Numeric UID so that runAsNonRoot works in Kubernetes.
USER 1000
EXPOSE 8080

# Start node directly (not via npm) so SIGTERM reaches the process
CMD ["node", "src/server.js"]
