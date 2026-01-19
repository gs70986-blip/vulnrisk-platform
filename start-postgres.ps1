# 启动 PostgreSQL 数据库服务
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "启动 PostgreSQL 数据库服务" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

Write-Host "`n步骤1: 检查 Docker Compose 配置..." -ForegroundColor Yellow
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "错误: 找不到 docker-compose.yml 文件" -ForegroundColor Red
    exit 1
}

Write-Host "`n步骤2: 启动 PostgreSQL 服务..." -ForegroundColor Yellow
docker-compose up -d postgres

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n步骤3: 等待 PostgreSQL 启动..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    Write-Host "`n步骤4: 检查服务状态..." -ForegroundColor Yellow
    docker-compose ps postgres
    
    Write-Host "`n步骤5: 创建数据库（如果不存在）..." -ForegroundColor Yellow
    docker-compose exec -T postgres psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname='vulnrisk'" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "创建数据库 vulnrisk..." -ForegroundColor Green
        docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE vulnrisk;"
    } else {
        Write-Host "数据库 vulnrisk 已存在" -ForegroundColor Green
    }
    
    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host "PostgreSQL 服务已启动！" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "`n连接信息:" -ForegroundColor Yellow
    Write-Host "  主机: localhost" -ForegroundColor White
    Write-Host "  端口: 5432" -ForegroundColor White
    Write-Host "  数据库: vulnrisk" -ForegroundColor White
    Write-Host "  用户名: postgres" -ForegroundColor White
    Write-Host "  密码: postgres" -ForegroundColor White
    Write-Host "`n下一步: 运行数据库迁移" -ForegroundColor Yellow
    Write-Host "  cd backend-node" -ForegroundColor Gray
    Write-Host "  npx prisma migrate deploy" -ForegroundColor Gray
} else {
    Write-Host "`n错误: 无法启动 PostgreSQL 服务" -ForegroundColor Red
    Write-Host "请检查 Docker Desktop 是否正在运行" -ForegroundColor Yellow
    exit 1
}











