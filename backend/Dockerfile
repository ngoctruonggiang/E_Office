# ─────────────────────────────────────────────────────────────
# gafood backend (NestJS + Prisma) — multi-stage production image
#
# Builds the app, generates the Prisma client, and on startup applies
# pending migrations (`prisma migrate deploy`) before booting Nest.
# The app listens on $PORT (default 8080) — see src/main.ts.
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /usr/src/app
# OpenSSL is required by Prisma's query engine on Alpine.
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /usr/src/app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV PORT=8080

# Carry over the already-installed deps (incl. the generated Prisma client and
# the Prisma CLI used for `migrate deploy`), the build output and the schema.
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/package.json ./package.json

EXPOSE 8080
# Apply DB migrations, then start. `migrate deploy` is safe to run on every
# boot — it only applies migrations that haven't been applied yet.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
