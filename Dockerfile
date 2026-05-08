# Build stage
FROM oven/bun:latest as build-stage
WORKDIR /app

# Accept build arguments
ARG VITE_API_URL
ARG VITE_PRIVY_APP_ID

# Set them as environment variables so Vite can see them
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PRIVY_APP_ID=$VITE_PRIVY_APP_ID

# Copy the entire monorepo to ensure all context is available
COPY . .

# Move into the frontend directory for the build
WORKDIR /app/frontend

# Install and build
RUN bun install --frozen-lockfile
RUN bun run build

# Production stage
FROM nginx:stable-alpine as production-stage
# Copy the build output from the frontend/dist folder
COPY --from=build-stage /app/frontend/dist /usr/share/nginx/html

# Cloud Run requires the container to listen on the $PORT environment variable
CMD ["/bin/sh", "-c", "sed -i 's/80/'\"$PORT\"'/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
