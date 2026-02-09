# Prisma Studio 启动脚本
# 设置数据库连接 URL
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/vulnrisk?schema=public"

Write-Host "正在启动 Prisma Studio..." -ForegroundColor Green
Write-Host "数据库 URL: $env:DATABASE_URL" -ForegroundColor Yellow
Write-Host ""
Write-Host "Prisma Studio 将在浏览器中打开: http://localhost:5555" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 停止 Prisma Studio" -ForegroundColor Yellow
Write-Host ""

# 启动 Prisma Studio
npx prisma studio

