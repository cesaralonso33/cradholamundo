FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/src/db/schema.ts ./src/db/schema.ts
COPY package*.json ./
RUN mkdir -p uploads
EXPOSE 3000
CMD ["sh", "-c", "npx drizzle-kit migrate && node dist/index.js"]
