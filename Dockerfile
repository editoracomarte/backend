FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 1337

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

FROM base AS dev
CMD ["npm", "run", "develop"]

FROM base AS prod
ENV NODE_ENV=production
ENV STRAPI_TELEMETRY_DISABLED=1
RUN npm run build
CMD ["npm", "start"]
