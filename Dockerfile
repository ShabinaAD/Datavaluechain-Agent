# Build the frontend and run the Express server that serves it + the API/AI proxy.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# base path defaults to "/" so the app is served from the domain root
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
# Hosts read $PORT; the server falls back to 8787 locally.
EXPOSE 8787
CMD ["node", "server/index.js"]
