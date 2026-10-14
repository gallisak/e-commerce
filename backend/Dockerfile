# Build context: repository root (shared npm workspaces lockfile)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci -w backend --include-workspace-root=false

FROM deps AS build
COPY backend/ backend/
RUN npm run build -w backend

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci -w backend --include-workspace-root=false --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
WORKDIR /app/backend
RUN mkdir -p uploads && chown -R node:node uploads
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
