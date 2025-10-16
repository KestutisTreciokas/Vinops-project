# --- deps ---
FROM node:20-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci || npm install --no-audit --no-fund

# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node -v && npm run build

# --- runner ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN adduser -D -H -s /sbin/nologin nextjs
# runtime deps
COPY --from=build /app/node_modules ./node_modules
# app
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
# configs (любая из них может отсутствовать — это нормально)
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/package.json ./package.json
USER nextjs
EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","-H","0.0.0.0","-p","3000"]
