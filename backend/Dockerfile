# Use the official Bun image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Install system dependencies needed for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files from the backend directory
COPY backend/package.json backend/bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the backend code
COPY backend/ .

# Generate Prisma client
# Use a placeholder DATABASE_URL to prevent Prisma from failing during build if it checks the env
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN bun x prisma generate

# Expose the port (GCP Cloud Run uses 8080 by default)
EXPOSE 8080

# Start the application
CMD ["bun", "run", "src/index.ts"]
