require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { parse } = require('csv-parse/sync');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

// CSV 文件配置
// 文件已通过 docker-compose.yml 挂载到容器
const csvFiles = [
  {
    name: 'merged_json_table',
    paths: [
      '/app/merged_json_table.csv',  // 挂载路径
    ],
    description: 'CVE 数据集（正样本）',
  },
  {
    name: 'negative_github_issues',
    paths: [
      '/app/negative_github_issues.csv',  // 挂载路径
    ],
    description: 'GitHub Issues 负样本数据集',
  },
  {
    name: 'neg_keyword_only',
    paths: [
      '/app/data_aug/neg_keyword_only.csv',  // 挂载路径
    ],
    description: '数据增强 - 仅关键词负样本',
  },
  {
    name: 'neg_noise',
    paths: [
      '/app/data_aug/neg_noise.csv',  // 挂载路径
    ],
    description: '数据增强 - 噪声负样本',
  },
  {
    name: 'neg_patch_mitigation',
    paths: [
      '/app/data_aug/neg_patch_mitigation.csv',  // 挂载路径
    ],
    description: '数据增强 - 补丁/缓解措施负样本',
  },
];

// 查找文件的实际路径
async function findFile(paths) {
  for (const filePath of paths) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch (error) {
      // 继续尝试下一个路径
    }
  }
  return null;
}

// 推断字段类型
function inferType(value) {
  if (value === null || value === undefined || value === '') {
    return 'string';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'float';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'string') {
    // 尝试解析为数字
    const num = parseFloat(value);
    if (!isNaN(num) && value.trim() !== '') {
      return Number.isInteger(num) ? 'integer' : 'float';
    }
    // 检查是否是日期
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return 'date';
    }
    return 'string';
  }
  return 'string';
}

// 解析 CSV 文件
async function parseCSV(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        // 尝试转换数字字段
        const columnName = context.column ? String(context.column) : '';
        if (columnName && (columnName.includes('score') || columnName.includes('cvss') || columnName === 'label')) {
          const num = parseFloat(value);
          return isNaN(num) ? value : num;
        }
        return value;
      },
    });
    return records;
  } catch (error) {
    console.error(`读取文件 ${filePath} 时出错:`, error.message);
    throw error;
  }
}

// 分析 schema
function analyzeSchema(data) {
  if (data.length === 0) {
    return { fields: [], recordCount: 0 };
  }

  const firstRow = data[0];
  const fields = Object.keys(firstRow).map(key => ({
    name: key,
    type: inferType(firstRow[key]),
    sample: firstRow[key] ? String(firstRow[key]).substring(0, 100) : null,
  }));

  return {
    fields,
    recordCount: data.length,
  };
}

// 导入单个数据集
async function importDataset(config) {
  console.log(`\n正在导入: ${config.name} (${config.description})`);
  
  // 查找文件的实际路径
  const filePath = await findFile(config.paths);
  if (!filePath) {
    console.error(`  错误: 文件不存在，尝试的路径:`);
    config.paths.forEach(p => console.error(`    - ${p}`));
    return null;
  }
  
  console.log(`文件路径: ${filePath}`);

  // 检查是否已存在
  const existing = await prisma.dataset.findFirst({
    where: { name: config.name },
  });

  if (existing) {
    console.log(`  警告: 数据集 "${config.name}" 已存在，将更新...`);
    // 删除旧数据集
    await prisma.dataset.delete({
      where: { id: existing.id },
    });
    // 删除旧数据文件
    try {
      const oldDataDir = path.join('/app/data', existing.id);
      await fs.rm(oldDataDir, { recursive: true, force: true });
    } catch (err) {
      // 忽略删除错误
    }
  }

  // 解析 CSV
  console.log(`  正在解析 CSV 文件...`);
  const data = await parseCSV(filePath);
  console.log(`  解析完成，共 ${data.length} 条记录`);

  // 分析 schema
  const schema = analyzeSchema(data);
  console.log(`  Schema: ${schema.fields.length} 个字段`);

  // 创建数据集记录
  const dataset = await prisma.dataset.create({
    data: {
      name: config.name,
      schema: schema,
      recordCount: data.length,
    },
  });
  console.log(`  数据集已创建: ${dataset.id}`);

  // 保存数据到文件（在容器内的路径）
  const datasetDir = path.join('/app/data', dataset.id);
  await fs.mkdir(datasetDir, { recursive: true });
  const dataFile = path.join(datasetDir, 'data.json');
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
  console.log(`  数据文件已保存: ${dataFile}`);

  return {
    ...dataset,
    recordCount: data.length,
  };
}

// 主函数
async function main() {
  console.log('=== CSV 数据集导入工具 ===');
  console.log(`共 ${csvFiles.length} 个文件需要导入\n`);

  const results = [];

  for (const config of csvFiles) {
    try {
      const result = await importDataset(config);
      if (result) {
        results.push({
          name: config.name,
          status: 'success',
          recordCount: result.recordCount,
        });
      } else {
        results.push({
          name: config.name,
          status: 'skipped',
          recordCount: 0,
        });
      }
    } catch (error) {
      console.error(`  错误: ${error.message}`);
      results.push({
        name: config.name,
        status: 'error',
        error: error.message,
        recordCount: 0,
      });
    }
  }

  // 显示汇总
  console.log('\n=== 导入汇总 ===');
  console.table(results);

  const successCount = results.filter(r => r.status === 'success').length;
  const totalRecords = results.reduce((sum, r) => sum + (r.recordCount || 0), 0);

  console.log(`\n成功导入: ${successCount}/${csvFiles.length} 个数据集`);
  console.log(`总记录数: ${totalRecords.toLocaleString()} 条`);

  // 显示所有数据集
  console.log('\n=== 数据库中的数据集 ===');
  const allDatasets = await prisma.dataset.findMany({
    orderBy: { createdAt: 'desc' },
  });
  console.table(allDatasets.map(d => ({
    id: d.id.substring(0, 8) + '...',
    name: d.name,
    recordCount: d.recordCount,
    createdAt: d.createdAt.toISOString().substring(0, 19),
  })));
}

main()
  .catch((e) => {
    console.error('导入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

