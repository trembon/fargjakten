# Bygger klienten i ett steg och kör bara servern (utan utvecklingsverktyg) i det färdiga steget.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=4321
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY client/index.html client/style.css client/manifest.json ./client/
COPY --from=build /app/public ./public
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s CMD wget -qO- http://127.0.0.1:${PORT}/version || exit 1
CMD ["node", "server/index.js"]
