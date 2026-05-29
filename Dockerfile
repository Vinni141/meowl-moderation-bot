FROM node:22-bookworm-slim AS app

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.4 --activate

COPY package.json ./
COPY prisma ./prisma
RUN pnpm install --no-frozen-lockfile --prod=false

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

RUN pnpm build \
  && pnpm exec prisma generate \
  && mkdir -p /app/data \
  && chown -R node:node /app

ENV NODE_ENV=production

USER node

EXPOSE 3000

CMD ["sh", "-c", "pnpm db:push && pnpm start"]
