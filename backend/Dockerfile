# Use the official Bun image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Install system dependencies needed for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the code
COPY . .

# Debug: list files to ensure we are in the right place
RUN ls -la

# Generate Prisma client
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN ./node_modules/.bin/prisma generate

# Expose the port (GCP Cloud Run uses 8080 by default)
EXPOSE 8080

# Start the application
CMD ["bun", "run", "src/index.ts"]
