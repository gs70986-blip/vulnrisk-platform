@echo off
REM VulnRisk Platform Startup Script for Windows

echo Starting VulnRisk Platform...

REM Create necessary directories
if not exist "data" mkdir data
if not exist "models" mkdir models
if not exist "backend-node\uploads" mkdir backend-node\uploads

REM Start services
docker-compose up -d

echo Waiting for services to be ready...
timeout /t 10 /nobreak

REM Run database migrations
echo Running database migrations...
docker-compose exec -T backend-node npx prisma migrate deploy

echo Services are starting up...
echo Frontend: http://localhost
echo Backend API: http://localhost:3000
echo ML Service: http://localhost:5000

















