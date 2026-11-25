FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY lib ./lib
COPY server.mjs ./
COPY dist ./dist
ENV HOST=0.0.0.0 PORT=4318 DATABASE_PATH=/app/data/research.sqlite NODE_ENV=production
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 4318
CMD ["node", "server.mjs"]
