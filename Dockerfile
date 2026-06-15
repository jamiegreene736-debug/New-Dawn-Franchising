# Test-only tooling (Cypress / Playwright) ships browser binaries via postinstall.
# Skip those downloads so `npm ci` cannot fail the build on networks that block
# the binary CDNs — the production server never needs them.
FROM node:20-alpine AS builder
WORKDIR /app
ENV CYPRESS_INSTALL_BINARY=0
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV CYPRESS_INSTALL_BINARY=0
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
