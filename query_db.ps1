# 数据库查询脚本
# 使用方法: .\query_db.ps1

Write-Host "=== VulnRisk 数据库查询工具 ===" -ForegroundColor Green
Write-Host ""

# 查看所有表
Write-Host "1. 查看所有表:" -ForegroundColor Yellow
docker exec vulnrisk-postgres psql -U postgres -d vulnrisk -c "\dt"

Write-Host "`n2. 查看预测结果总数:" -ForegroundColor Yellow
docker exec vulnrisk-postgres psql -U postgres -d vulnrisk -c "SELECT COUNT(*) as total_predictions FROM predictions;"

Write-Host "`n3. 查看模型列表:" -ForegroundColor Yellow
docker exec vulnrisk-postgres psql -U postgres -d vulnrisk -c "SELECT id, type, \"isActive\" FROM ml_models ORDER BY \"createdAt\" DESC;"

Write-Host "`n4. 查看最近的5条预测结果:" -ForegroundColor Yellow
docker exec vulnrisk-postgres psql -U postgres -d vulnrisk -c "SELECT id, \"sampleId\", \"pVuln\", \"riskLevel\", \"createdAt\" FROM predictions ORDER BY \"createdAt\" DESC LIMIT 5;"

Write-Host "`n5. 查看预测结果的严重程度分布:" -ForegroundColor Yellow
docker exec vulnrisk-postgres psql -U postgres -d vulnrisk -c "SELECT \"riskLevel\", COUNT(*) as count FROM predictions GROUP BY \"riskLevel\" ORDER BY count DESC;"

Write-Host "`n=== 交互式查询 ===" -ForegroundColor Green
Write-Host "要执行自定义 SQL 查询，请使用以下命令:"
Write-Host "docker exec vulnrisk-postgres psql -U postgres -d vulnrisk -c \"你的SQL查询\"" -ForegroundColor Cyan
Write-Host ""
Write-Host "或者进入交互式模式:"
Write-Host "docker exec -it vulnrisk-postgres psql -U postgres -d vulnrisk" -ForegroundColor Cyan

