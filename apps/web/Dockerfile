# Stage 1: Builder
# This stage installs all dependencies, builds the source code, and creates the final artifacts.
FROM node:18-alpine AS builder
WORKDIR /app

# Copy all package.json and lock files first to leverage Docker cache
COPY package.json package-lock.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

# Install ALL monorepo dependencies
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the specific 'web' workspace and its dependencies
RUN npm run build --workspace=@finito/web

# Stage 2: Runner
# This stage creates the final, lean production image.
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy production node_modules and the built 'web' app from the builder stage
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/node_modules ./node_modules

# Prune development-only dependencies from the copied node_modules
RUN npm prune --production

# Set the working directory to the specific app we want to run
WORKDIR /app/apps/web

# Expose port
EXPOSE 3000

# The "start" script in 'apps/web/package.json' should run the built output
CMD ["npm", "start"]