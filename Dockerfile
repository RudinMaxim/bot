FROM node:24.12.0-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN rm -rf node_modules && npm ci --omit=dev

FROM node:24.12.0-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ARG INSTALL_PLAYWRIGHT_BROWSER=false

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist/scripts ./dist/scripts
COPY --from=builder /app/resources ./resources
COPY --from=builder /app/scripts ./scripts

RUN if [ "$INSTALL_PLAYWRIGHT_BROWSER" = "true" ]; then npx playwright install --with-deps chromium; fi

USER node

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "const http=require('http'); const req=http.get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health/live', res => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.setTimeout(4000, () => { req.destroy(); process.exit(1); });"

CMD ["node", "dist/src/main"]
