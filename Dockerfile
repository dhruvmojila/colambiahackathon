# ===== SignPulse AI Docker Build =====
# Multi-stage build for optimized Next.js standalone deployment

# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Build the application
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env — NEXT_PUBLIC_ vars are baked into client JS during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_SIGNPULSE_API=https://signpulse-backend-973006952011.us-central1.run.app

RUN npm run build

# Stage 3: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
ENV NEXT_PUBLIC_SIGNPULSE_API=https://signpulse-backend-973006952011.us-central1.run.app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy service account file
# COPY --chown=nextjs:nodejs service-account.json ./service-account.json

# Set service account env
# ENV GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
