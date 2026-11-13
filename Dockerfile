# The www site as a standalone Next.js server. Built by .github/workflows/docker.yml
# and run on sm2 (see notes/infra/www-box in the dev harness).
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# NEXT_PUBLIC_* values are inlined into the browser bundle, so they are build args.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
# pnpm build also fetches the catalog and builds the search index.
# Server tokens are build secrets: pages prerendered at build time need them, the image must not keep them.
RUN --mount=type=secret,id=CLERK_SECRET_KEY,env=CLERK_SECRET_KEY \
    --mount=type=secret,id=PATREON_CREATOR_TOKEN,env=PATREON_CREATOR_TOKEN \
    --mount=type=secret,id=FOURTHWALL_STOREFRONT_TOKEN,env=FOURTHWALL_STOREFRONT_TOKEN \
    pnpm build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
# Mount point for the next/image cache volume. A new named volume copies this owner.
RUN mkdir -p .next/cache/images
EXPOSE 3000
CMD ["node", "server.js"]
