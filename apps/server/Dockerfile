# Base image with Deno
FROM denoland/deno:alpine-2.4.0 AS base
WORKDIR /app

# Install any needed system packages (e.g. OpenSSL for Prisma)
RUN apk add --no-cache openssl libc6-compat

# Build stage
FROM base AS builder
WORKDIR /app

# Copy everything
COPY . .

# Generate DB schema and OpenAPI spec
RUN deno task db-generate && deno task tsoa && deno task openapi

# Final runtime image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -S -g 1001 nodejs && \
  adduser -S -D -u 1001 -G nodejs server
USER server

# Copy Swagger spec
COPY --from=builder --chown=server:nodejs \
  /app/apps/server/build/swagger.yaml \
  /app/apps/server/build/swagger.yaml

# Copy Deno-generated node_modules and generated server artifacts
COPY --from=builder --chown=server:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=server:nodejs /app/apps/server/build /app/apps/server/build
COPY --from=builder --chown=server:nodejs /app/apps/server/prisma /app/apps/server/prisma
COPY --from=builder --chown=server:nodejs /app/packages /app/packages

EXPOSE 3000
WORKDIR /app
CMD ["deno", "task", "server"]
