FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build || true

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001
COPY --from=build /app ./
EXPOSE 3001
CMD ["sh","-lc","node dist/index.js || node dist/server.js || npm start"]
