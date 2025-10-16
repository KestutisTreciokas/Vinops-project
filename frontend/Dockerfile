# --- deps ---
FROM node:20-alpine AS deps
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/package*.json ./
RUN npm ci || npm install --no-audit --no-fund

# --- build ---
FROM node:20-alpine AS build
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY frontend ./
COPY contracts ../contracts
RUN node -v && npm run build

# --- runner ---
FROM node:20-alpine AS runner
WORKDIR /app/frontend
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN adduser -D -H -s /sbin/nologin nextjs
# runtime deps
COPY --from=build /app/frontend/node_modules ./node_modules
# app
COPY --from=build /app/frontend/.next ./.next
COPY --from=build /app/frontend/public ./public
# configs (любая из них может отсутствовать — это нормально)
COPY --from=build /app/frontend/next.config.mjs ./next.config.mjs
COPY --from=build /app/frontend/next.config.js ./next.config.js
COPY --from=build /app/frontend/package.json ./package.json
USER nextjs
EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","-H","0.0.0.0","-p","3000"]
