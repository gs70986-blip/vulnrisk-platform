#!/bin/bash
# 在容器内恢复数据的辅助脚本
# 如果容器内没有 scripts 目录，从宿主机复制并执行

echo "尝试在容器内执行数据恢复..."

# 方法1: 尝试在容器内执行
if docker-compose exec -T backend-node test -f /app/scripts/restore-data.js 2>/dev/null; then
    echo "在容器内找到脚本，执行中..."
    docker-compose exec -T backend-node node /app/scripts/restore-data.js
    exit $?
fi

# 方法2: 如果容器内没有，从宿主机执行（需要本地有 Node.js）
echo "容器内未找到脚本，尝试从宿主机执行..."
if command -v node &> /dev/null; then
    cd backend-node
    node scripts/restore-data.js
    exit $?
else
    echo "错误: 容器内和宿主机都无法执行脚本"
    echo "请手动执行: cd backend-node && node scripts/restore-data.js"
    exit 1
fi

