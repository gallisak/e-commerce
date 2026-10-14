FROM node:24-alpine AS build
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/prisma.config.ts backend/
COPY backend/prisma backend/prisma
RUN --mount=type=cache,target=/root/.npm npm ci -w backend --include-workspace-root=false
COPY backend/ backend/
RUN npm run build -w backend \
 && npm prune --omit=dev -w backend --include-workspace-root=false \
 && rm -rf backend/src backend/test

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/backend backend
WORKDIR /app/backend
RUN mkdir -p uploads && chown -R node:node uploads
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
