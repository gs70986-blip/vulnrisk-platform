@echo off
REM VulnRisk Production Deployment Script (Windows)
REM For project demonstration

chcp 65001 >nul 2>&1
echo ============================================================
echo VulnRisk Production Deployment Script
echo ============================================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running, please start Docker Desktop first
    pause
    exit /b 1
)

echo [1/6] Checking Docker status...
docker ps >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker service is not running properly
    pause
    exit /b 1
)
echo [OK] Docker is running normally
echo.

REM Create necessary directories
echo [2/6] Creating necessary directories...
if not exist "data" mkdir data
if not exist "models" mkdir models
if not exist "backend-node\uploads" mkdir backend-node\uploads
echo [OK] Directories created
echo.

REM Stop existing services
echo [3/6] Stopping existing services...
docker-compose down
echo [OK] Services stopped
echo.

REM Build and start services
echo [4/6] Building and starting all services...
echo This may take a few minutes, please wait...
docker-compose up -d --build
if errorlevel 1 (
    echo [ERROR] Service startup failed
    pause
    exit /b 1
)
echo [OK] Services are starting...
echo.

REM Wait for services to be ready
echo [5/6] Waiting for services to be ready (30 seconds)...
timeout /t 30 /nobreak >nul
echo [OK] Wait completed
echo.

REM Initialize database
echo [6/6] Initializing database...
docker-compose exec -T backend-node npx prisma migrate deploy
if errorlevel 1 (
    echo [WARNING] Database migration may have failed, please check logs
) else (
    echo [OK] Database migration completed
)

REM Restore base data
echo.
echo Restoring base data (users and models)...
REM Execute from host machine (more reliable, no need for scripts in container)
if exist "backend-node\scripts\restore-data.js" (
    cd backend-node
    node scripts/restore-data.js
    cd ..
    if errorlevel 1 (
        echo [ERROR] Data restoration failed
        echo [TIP] Please ensure Node.js is installed, or manually execute: cd backend-node ^&^& node scripts/restore-data.js
    ) else (
        echo [OK] Base data restoration completed
    )
) else (
    echo [WARNING] restore-data.js script not found
    echo [TIP] Please manually restore data: cd backend-node ^&^& node scripts/restore-data.js
)

echo.
echo ============================================================
echo Deployment completed!
echo ============================================================
echo.
echo Access URLs:
echo   Frontend: http://localhost
echo   Backend API: http://localhost:3000
echo   ML Service: http://localhost:5000/health
echo.
echo Default login credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo Important notes:
echo   1. Please change the default password after first login
echo   2. You need to activate a model in Models page to use prediction
echo   3. Check service status: docker-compose ps
echo   4. View logs: docker-compose logs -f
echo.
echo ============================================================
pause
