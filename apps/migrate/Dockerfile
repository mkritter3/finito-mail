# ---- Base Stage ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

# ---- Dependencies Stage ----
FROM base AS dependencies
RUN npm ci

# ---- Production Stage ----
# This image contains everything needed to run the migration script
FROM dependencies AS production
COPY . .
# The command will be overridden in the ECS Task Definition,
# but we can set a default for clarity.
CMD ["node", "scripts/migrate.js"]