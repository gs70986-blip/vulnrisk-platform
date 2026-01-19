#!/bin/bash

# VulnRisk Platform Startup Script

echo "Starting VulnRisk Platform..."

# Create necessary directories
mkdir -p data models backend-node/uploads

# Start services
docker-compose up -d

echo "Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "Running database migrations..."
docker-compose exec -T backend-node npx prisma migrate deploy

echo "Services are starting up..."
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:3000"
echo "ML Service: http://localhost:5000"

















