const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('检查 risk_score 和 riskLevel 的映射关系:\n');
  
  // 查找所有预测记录，按创建时间降序
  const predictions = await prisma.prediction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,  // 增加数量以找到更多可能的错误
    include: { model: true }
  });

  console.log(`找到 ${predictions.length} 条最近的预测记录\n`);
  console.log('='.repeat(120));
  console.log('Sample ID'.padEnd(20) + 'riskScore'.padEnd(15) + 'riskLevel'.padEnd(15) + 'severityLevel'.padEnd(15) + '正确值'.padEnd(15) + '状态');
  console.log('='.repeat(120));

  predictions.forEach(p => {
    const meta = p.metadata || {};
    const riskScore = p.riskScore;
    const riskLevel = p.riskLevel;
    const severityLevel = meta.severityLevel || 'N/A';
    
    // 根据 risk_score 计算正确的 riskLevel（使用与 ML 服务相同的逻辑）
    let correctRiskLevel;
    if (riskScore < 0.4) {
      correctRiskLevel = 'Low';
    } else if (riskScore < 0.6) {
      correctRiskLevel = 'Medium';
    } else if (riskScore < 0.8) {
      correctRiskLevel = 'High';
    } else {
      correctRiskLevel = 'Critical';
    }
    
    // 检查边界值
    const isBoundary = riskScore === 0.4 || riskScore === 0.6 || riskScore === 0.8;
    
    const isCorrect = riskLevel === correctRiskLevel;
    const status = isCorrect ? '✓ 正确' : '✗ 错误';
    
    console.log(
      (p.sampleId || 'N/A').padEnd(20) +
      riskScore.toFixed(6).padEnd(15) +
      riskLevel.padEnd(15) +
      severityLevel.padEnd(15) +
      correctRiskLevel.padEnd(15) +
      status
    );
    
    if (!isCorrect) {
      console.log(`  ⚠️  警告: riskScore=${riskScore.toFixed(6)} 应该映射到 ${correctRiskLevel}，但实际是 ${riskLevel}`);
    }
    
    if (isBoundary) {
      console.log(`  ℹ️  边界值: riskScore=${riskScore.toFixed(6)} 是边界值`);
    }
  });

  await prisma.$disconnect();
}

main().catch(console.error);

