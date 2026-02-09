const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== VulnRisk 数据库查询 (Prisma) ===\n');

  try {
    // 1. 查看所有表的数据统计
    console.log('1. 数据统计:');
    const [predictionsCount, modelsCount, datasetsCount, usersCount] = await Promise.all([
      prisma.prediction.count(),
      prisma.mLModel.count(),
      prisma.dataset.count(),
      prisma.user.count(),
    ]);
    
    console.log(`   - 预测结果: ${predictionsCount} 条`);
    console.log(`   - 模型: ${modelsCount} 个`);
    console.log(`   - 数据集: ${datasetsCount} 个`);
    console.log(`   - 用户: ${usersCount} 个\n`);

    // 2. 查看模型列表
    console.log('2. 模型列表:');
    const models = await prisma.mLModel.findMany({
      select: {
        id: true,
        type: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    console.table(models);
    console.log('');

    // 3. 查看最近的预测结果
    console.log('3. 最近的 5 条预测结果:');
    const recentPredictions = await prisma.prediction.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        sampleId: true,
        pVuln: true,
        riskLevel: true,
        riskScore: true,
        createdAt: true,
      },
    });
    console.table(recentPredictions.map(p => ({
      id: p.id.substring(0, 8) + '...',
      sampleId: p.sampleId,
      pVuln: p.pVuln.toFixed(4),
      riskLevel: p.riskLevel,
      riskScore: p.riskScore.toFixed(4),
      createdAt: p.createdAt.toISOString().substring(0, 19),
    })));
    console.log('');

    // 4. 查看严重程度分布
    console.log('4. 严重程度分布:');
    const riskLevelStats = await prisma.prediction.groupBy({
      by: ['riskLevel'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });
    console.table(riskLevelStats.map(s => ({
      riskLevel: s.riskLevel,
      count: s._count.id,
    })));
    console.log('');

    // 5. 查看包含 metadata 的预测结果详情
    console.log('5. 预测结果详情（包含 metadata）:');
    const detailedPredictions = await prisma.prediction.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        sampleId: true,
        pVuln: true,
        riskLevel: true,
        riskScore: true,
        metadata: true,
        createdAt: true,
      },
    });
    
    detailedPredictions.forEach((pred, index) => {
      const meta = pred.metadata || {};
      // 优先读取新字段，fallback 到旧字段
      const isVulnRelated = meta.isVulnRelated ?? meta.applicable ?? 'N/A';
      const pVulnRelated = meta.pVulnRelated ?? meta.pApplicable ?? null;
      console.log(`\n   [${index + 1}] ${pred.sampleId}`);
      console.log(`   - ID: ${pred.id.substring(0, 8)}...`);
      console.log(`   - P(vuln): ${pred.pVuln.toFixed(4)}`);
      console.log(`   - Risk Level: ${pred.riskLevel}`);
      console.log(`   - Risk Score: ${pred.riskScore.toFixed(4)}`);
      console.log(`   - isVulnRelated: ${isVulnRelated}`);
      console.log(`   - pVulnRelated: ${pVulnRelated ? pVulnRelated.toFixed(4) : 'N/A'}`);
      console.log(`   - Severity Level: ${meta.severityLevel ?? 'N/A'}`);
      console.log(`   - Reliability: ${meta.reliability ?? 'N/A'}`);
      console.log(`   - Created: ${pred.createdAt.toISOString().substring(0, 19)}`);
    });
    console.log('');

    // 6. 查看两阶段预测的统计
    console.log('6. 两阶段预测统计:');
    const allPredictions = await prisma.prediction.findMany({
      select: {
        metadata: true,
      },
    });
    
    const stats = {
      isVulnRelated: 0,
      notVulnRelated: 0,
      withSeverity: 0,
      withoutSeverity: 0,
    };
    
    allPredictions.forEach(pred => {
      const meta = pred.metadata || {};
      // 优先读取新字段，fallback 到旧字段
      const isVulnRelated = meta.isVulnRelated ?? meta.applicable;
      if (isVulnRelated === true) {
        stats.isVulnRelated++;
      } else if (isVulnRelated === false) {
        stats.notVulnRelated++;
      }
      if (meta.severityLevel) {
        stats.withSeverity++;
      } else {
        stats.withoutSeverity++;
      }
    });
    
    console.table(stats);
    console.log('');

  } catch (error) {
    console.error('查询错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

