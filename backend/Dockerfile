FROM oven/bun:1 AS base
WORKDIR /app

# Copy just the dependency manifest first (not the whole codebase yet) —
# Docker caches this layer, so if only your source code changes later
# (not your dependencies), rebuilding skips re-running "bun install"
# entirely, making rebuilds much faster.
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Now copy everything else (source code, prisma schema, etc.).
COPY . .

# Regenerate the Prisma Client inside the image, so its generated types
# match this exact copy of schema.prisma, not whatever was on your host
# machine when the image was built.
RUN bunx prisma generate

EXPOSE 4000
CMD ["bun", "run", "start"]