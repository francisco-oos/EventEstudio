FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends gosu \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/storage/data/temp /app/storage/uploads/guest-photos /app/storage/uploads/site-media \
  && chown -R node:node /app \
  && chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_ROOT=/app/storage

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
