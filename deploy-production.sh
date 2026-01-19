#!/bin/bash

# VulnRisk 生产环境部署脚本 (Linux/Mac)
# 用于项目答辩演示

echo "============================================================"
echo "VulnRisk 生产环境部署脚本"
echo "============================================================"
echo

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "[错误] Docker 未运行，请先启动 Docker"
    exit 1
fi

echo "[1/6] 检查 Docker 状态..."
if ! docker ps > /dev/null 2>&1; then
    echo "[错误] Docker 服务未正常运行"
    exit 1
fi
echo "[OK] Docker 运行正常"
echo

# 创建必要的目录
echo "[2/6] 创建必要的目录..."
mkdir -p data models backend-node/uploads
echo "[OK] 目录创建完成"
echo

# 停止现有服务
echo "[3/6] 停止现有服务..."
docker-compose down
echo "[OK] 服务已停止"
echo

# 构建并启动服务
echo "[4/6] 构建并启动所有服务..."
echo "这可能需要几分钟时间，请耐心等待..."
if ! docker-compose up -d --build; then
    echo "[错误] 服务启动失败"
    exit 1
fi
echo "[OK] 服务启动中..."
echo

# 等待服务就绪
echo "[5/6] 等待服务就绪（30秒）..."
sleep 30
echo "[OK] 等待完成"
echo

# 初始化数据库
echo "[6/6] 初始化数据库..."
if ! docker-compose exec -T backend-node npx prisma migrate deploy; then
    echo "[警告] 数据库迁移可能失败，请检查日志"
else
    echo "[OK] 数据库迁移完成"
fi

# 恢复基础数据
echo
echo "恢复基础数据（用户和模型）..."
# 优先尝试从宿主机执行（更可靠）
if [ -f "backend-node/scripts/restore-data.js" ]; then
    echo "[信息] 从宿主机执行数据恢复脚本..."
    cd backend-node
    if node scripts/restore-data.js; then
        echo "[OK] 基础数据恢复完成"
    else
        echo "[错误] 数据恢复失败"
        echo "[提示] 请确保已安装 Node.js"
    fi
    cd ..
else
    echo "[警告] 未找到 restore-data.js 脚本"
    echo "[提示] 请手动执行数据恢复: cd backend-node && node scripts/restore-data.js"
fi

echo
echo "============================================================"
echo "部署完成！"
echo "============================================================"
echo
echo "访问地址:"
echo "  前端界面: http://localhost"
echo "  后端 API: http://localhost:3000"
echo "  ML 服务: http://localhost:5000/health"
echo
echo "默认登录信息:"
echo "  用户名: admin"
echo "  密码: admin123"
echo
echo "重要提示:"
echo "  1. 请登录后立即修改默认密码"
echo "  2. 需要在 Models 页面激活一个模型才能使用预测功能"
echo "  3. 查看服务状态: docker-compose ps"
echo "  4. 查看日志: docker-compose logs -f"
echo
echo "============================================================"

