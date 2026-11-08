# Multi-stage Cloud Run container build for MarombApp (marombapp-serving).
# Compiles the Vite PWA bundle and TypeScript BFF in a builder stage, then runs
# the compiled server as a non-root user on node:22-slim listening on port 8080.

FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN=""
ARG VITE_FIREBASE_PROJECT_ID=""
ARG VITE_FIREBASE_APP_ID=""
ARG VITE_FIREBASE_ALLOWED_UID=""
ARG VITE_FIRESTORE_DATABASE_ID="marombapp"

ENV VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY} \
    VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN} \
    VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID} \
    VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID} \
    VITE_FIREBASE_ALLOWED_UID=${VITE_FIREBASE_ALLOWED_UID} \
    VITE_FIRESTORE_DATABASE_ID=${VITE_FIRESTORE_DATABASE_ID}

RUN npm run build

FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/dist-server ./dist-server

USER node

EXPOSE 8080

CMD ["node", "dist-server/index.js"]
