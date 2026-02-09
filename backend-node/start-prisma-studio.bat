@echo off
REM Prisma Studio 启动脚本
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vulnrisk?schema=public

echo 正在启动 Prisma Studio...
echo 数据库 URL: %DATABASE_URL%
echo.
echo Prisma Studio 将在浏览器中打开: http://localhost:5555
echo 按 Ctrl+C 停止 Prisma Studio
echo.

npx prisma studio

