FROM node:18-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install Prisma CLI
RUN npm install -g prisma

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Ensure scripts directory exists and is accessible
RUN mkdir -p scripts && chmod +x scripts/*.js 2>/dev/null || true

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p uploads data

EXPOSE 3000

CMD ["npm", "start"]


