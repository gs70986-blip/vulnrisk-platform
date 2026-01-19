@echo off
REM 重建并重启前端Docker容器
echo ============================================================
echo 重建前端Docker容器
echo ============================================================

echo.
echo 步骤1: 停止前端容器...
docker-compose stop frontend-vue

echo.
echo 步骤2: 重建前端镜像...
docker-compose build frontend-vue

echo.
echo 步骤3: 启动前端容器...
docker-compose up -d --force-recreate frontend-vue

echo.
echo ============================================================
echo 前端容器已重建并启动
echo ============================================================
echo.
echo 查看日志: docker-compose logs -f frontend-vue
echo 访问前端: http://localhost











