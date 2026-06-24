# ────────── Stage 1: Build ──────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk update && apk upgrade --no-cache

COPY package*.json ./
RUN npm install

COPY src/ ./src/

# ────────── Stage 2: Production ─────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache netcat-openbsd su-exec curl

COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/src ./src
COPY scripts/entrypoint.sh ./scripts/entrypoint.sh

RUN mkdir -p uploads/documents uploads/temp && \
    chmod +x ./scripts/entrypoint.sh && \
    chown -R node:node /app

EXPOSE 3001

USER node

ENTRYPOINT ["./scripts/entrypoint.sh"]
