/**
 * GitHub Search 全站语料导出脚本
 * 调用后端API导出GitHub issues和PRs语料
 * 
 * 用法:
 *   node scripts/export-github-search-corpus.js [targetCount] [--no-comments] [--max-comments N] [--corpusType security|negative]
 * 
 * 环境变量配置 (在 .env 文件中设置):
 *   - GITHUB_TOKEN: GitHub API token (可选，但建议设置以提高速率限制)
 *   - API_BASE_URL: 后端API地址 (默认: http://localhost:3000)
 *   - JWT_TOKEN: JWT认证token (可选，如果已获取token)
 *   - API_USERNAME: 用于自动登录的用户名 (默认: admin)
 *   - API_PASSWORD: 用于自动登录的密码 (必需，如果没有提供JWT_TOKEN)
 * 
 * 示例:
 *   node scripts/export-github-search-corpus.js
 *   node scripts/export-github-search-corpus.js 3000
 *   node scripts/export-github-search-corpus.js 2200 --no-comments
 *   node scripts/export-github-search-corpus.js 2200 --max-comments 50
 */

const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 加载 .env 文件（从多个可能的位置）
const envPaths = [
  path.join(__dirname, '..', '.env'),           // backend-node/.env
  path.join(__dirname, '..', '..', '.env'),     // 项目根目录/.env
  path.join(process.cwd(), '.env'),              // 当前工作目录/.env
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`[DEBUG] 加载 .env 文件: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  // 尝试默认位置
  dotenv.config();
  console.log('[DEBUG] 使用默认 dotenv.config()');
}

// 配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = process.env.JWT_TOKEN || ''; // 可选，如果API需要认证
const API_USERNAME = process.env.API_USERNAME || 'admin'; // 用于自动登录
const API_PASSWORD = process.env.API_PASSWORD || ''; // 用于自动登录

// 调试信息
if (process.env.DEBUG) {
  console.log('[DEBUG] 环境变量:');
  console.log(`  API_BASE_URL: ${API_BASE_URL}`);
  console.log(`  API_USERNAME: ${API_USERNAME}`);
  console.log(`  API_PASSWORD: ${API_PASSWORD ? '***已设置***' : '未设置'}`);
  console.log(`  JWT_TOKEN: ${JWT_TOKEN ? '***已设置***' : '未设置'}`);
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let targetCount = 2200;
  let includeComments = true;
  let maxCommentsPerItem = 30;
  let corpusType = 'security';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--no-comments') {
      includeComments = false;
    } else if (arg === '--max-comments' && i + 1 < args.length) {
      maxCommentsPerItem = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--corpusType' && i + 1 < args.length) {
      corpusType = args[i + 1];
      i++;
      // Set default targetCount for negative corpus
      if (corpusType === 'negative' && targetCount === 2200) {
        targetCount = 7000;
      }
    } else if (!isNaN(parseInt(arg, 10)) && parseInt(arg, 10) > 0) {
      targetCount = parseInt(arg, 10);
    }
  }

  return { targetCount, includeComments, maxCommentsPerItem, corpusType };
}

/**
 * 登录获取JWT token
 */
async function login() {
  if (JWT_TOKEN) {
    return JWT_TOKEN; // 如果已经提供了token，直接返回
  }

  if (!API_PASSWORD) {
    throw new Error(
      '需要提供认证信息。请设置以下环境变量之一：\n' +
      '  1. JWT_TOKEN=your_jwt_token (直接提供token)\n' +
      '  2. API_USERNAME=username 和 API_PASSWORD=password (自动登录)\n' +
      '可以在 .env 文件中设置这些变量。'
    );
  }

  const loginUrl = `${API_BASE_URL}/api/auth/login`;
  console.log(`正在登录... (用户名: ${API_USERNAME})`);

  try {
    const response = await axios.post(loginUrl, {
      username: API_USERNAME,
      password: API_PASSWORD,
    });

    if (response.data && response.data.token) {
      console.log('登录成功！');
      return response.data.token;
    } else {
      throw new Error('登录响应中未找到token');
    }
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      throw new Error(
        `登录失败 (${status}): ${data?.error || error.message}\n` +
        '请检查 API_USERNAME 和 API_PASSWORD 是否正确。'
      );
    } else if (error.request) {
      throw new Error(
        `无法连接到API服务器: ${API_BASE_URL}\n请确保后端服务正在运行。`
      );
    } else {
      throw new Error(`登录错误: ${error.message}`);
    }
  }
}

/**
 * 调用导出API
 */
async function exportCorpus(targetCount, includeComments, maxCommentsPerItem, corpusType) {
  // 先获取token
  const token = await login();

  const url = `${API_BASE_URL}/api/github/export-search-corpus`;
  const params = {
    targetCount,
    includeComments: includeComments.toString(),
    maxCommentsPerItem,
    corpusType,
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  console.log('='.repeat(60));
  console.log('GitHub Search 全站语料导出');
  console.log('='.repeat(60));
  console.log(`\n配置:`);
  console.log(`  API地址: ${API_BASE_URL}`);
  console.log(`  语料类型: ${corpusType}`);
  console.log(`  目标数量: ${targetCount}`);
  console.log(`  包含评论: ${includeComments}`);
  console.log(`  每条最大评论数: ${maxCommentsPerItem}`);
  console.log(`\n开始导出...\n`);

  try {
    const response = await axios.get(url, {
      params,
      headers,
      timeout: 0, // 无超时限制，因为导出可能需要很长时间
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      // HTTP错误响应
      const status = error.response.status;
      const data = error.response.data;
      throw new Error(
        `API错误 (${status}): ${data?.error || error.message}`
      );
    } else if (error.request) {
      // 请求已发出但没有收到响应
      throw new Error(
        `无法连接到API服务器: ${API_BASE_URL}\n请确保后端服务正在运行。`
      );
    } else {
      // 其他错误
      throw new Error(`请求错误: ${error.message}`);
    }
  }
}

/**
 * 将 Docker 路径转换为本地路径
 */
function resolveLocalPath(dockerPath) {
  // 如果是 Docker 路径（/app/data/...），转换为本地路径
  if (dockerPath.startsWith('/app/data/')) {
    const fileName = path.basename(dockerPath);
    // 尝试多个可能的本地路径
    const possiblePaths = [
      path.join(process.cwd(), 'data', fileName),           // 当前目录/data/
      path.join(__dirname, '..', '..', 'data', fileName),  // 项目根目录/data/
      path.join(__dirname, '..', 'data', fileName),         // backend-node/data/
    ];
    
    for (const localPath of possiblePaths) {
      if (fs.existsSync(localPath)) {
        return localPath;
      }
    }
    
    // 如果都不存在，返回项目根目录的路径（最可能的位置）
    return path.join(process.cwd(), 'data', fileName);
  }
  
  // 如果已经是本地路径，直接返回
  return dockerPath;
}

/**
 * 验证导出结果
 */
function validateExport(result) {
  const { totalDeduped, outputPath, summaryPath } = result;

  console.log('\n' + '='.repeat(60));
  console.log('导出完成');
  console.log('='.repeat(60));

  // 将 Docker 路径转换为本地路径
  const localOutputPath = resolveLocalPath(outputPath);
  const localSummaryPath = resolveLocalPath(summaryPath);

  console.log(`\n文件路径:`);
  console.log(`  原始路径: ${outputPath}`);
  console.log(`  本地路径: ${localOutputPath}`);

  // 检查文件是否存在
  if (!fs.existsSync(localOutputPath)) {
    console.warn(`\n警告: 输出文件不存在: ${localOutputPath}`);
    console.log(`尝试查找文件...`);
    
    // 尝试在常见位置查找
    const fileName = path.basename(outputPath);
    const searchPaths = [
      path.join(process.cwd(), 'data', fileName),
      path.join(__dirname, '..', '..', 'data', fileName),
      path.join(__dirname, '..', 'data', fileName),
    ];
    
    let found = false;
    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        console.log(`✓ 找到文件: ${searchPath}`);
        found = true;
        break;
      }
    }
    
    if (!found) {
      throw new Error(`输出文件不存在: ${localOutputPath}\n请检查后端服务是否正确保存了文件。`);
    }
  }

  if (!fs.existsSync(localSummaryPath)) {
    console.warn(`\n警告: 摘要文件不存在: ${localSummaryPath}`);
    // 摘要文件缺失不影响主要功能，只警告
  }

  // 读取并验证JSONL文件
  const jsonlContent = fs.readFileSync(localOutputPath, 'utf-8');
  const lines = jsonlContent.trim().split('\n').filter((line) => line.trim());
  const uniqueIds = new Set();

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.id) {
        uniqueIds.add(entry.id);
      }
    } catch (error) {
      console.warn(`警告: 无法解析JSONL行: ${line.substring(0, 100)}...`);
    }
  }

  console.log(`\n统计信息:`);
  console.log(`  总抓取数: ${result.totalFetched}`);
  console.log(`  去重后数量: ${result.totalDeduped}`);
  console.log(`  JSONL文件行数: ${lines.length}`);
  console.log(`  JSONL唯一ID数: ${uniqueIds.size}`);
  console.log(`  输出文件: ${localOutputPath}`);
  console.log(`  摘要文件: ${localSummaryPath}`);

  // 显示摘要信息
  if (result.summary) {
    console.log(`\n详细统计:`);
    console.log(`  导出日期: ${result.summary.export_date}`);
    console.log(`  语料类型: ${result.summary.corpus_type || 'security'}`);
    console.log(`  处理查询数: ${result.summary.queries_processed}`);
    console.log(`  问题数: ${result.summary.breakdown?.issues || 0}`);
    console.log(`  PR数: ${result.summary.breakdown?.pull_requests || 0}`);
    console.log(`  包含评论的条目: ${result.summary.breakdown?.with_comments || 0}`);
    console.log(`  总评论数: ${result.summary.breakdown?.total_comments || 0}`);
    
    if (result.summary.fallback_used) {
      console.log(`  Fallback已使用: ${result.summary.fallback_used}`);
    }
    
    if (result.summary.per_query_counts) {
      console.log(`\n每查询计数:`);
      for (const [queryKey, count] of Object.entries(result.summary.per_query_counts)) {
        console.log(`  ${queryKey}: ${count}`);
      }
    }

    if (result.summary.query_statistics) {
      console.log(`\n查询统计:`);
      for (const [queryKey, stats] of Object.entries(result.summary.query_statistics)) {
        console.log(`  ${queryKey}:`);
        console.log(`    抓取: ${stats.fetched}, 去重: ${stats.deduped}`);
      }
    }
  }

  // 验收检查（根据语料类型使用不同阈值）
  console.log('\n' + '='.repeat(60));
  console.log('验收检查');
  console.log('='.repeat(60));
  
  const corpusType = result.summary?.corpus_type || 'security';
  const minThreshold = corpusType === 'negative' ? 5000 : 2000;
  
  console.log(`语料类型: ${corpusType}, 最小阈值: ${minThreshold}`);

  if (uniqueIds.size >= minThreshold) {
    console.log(`[PASS] 通过: 去重行数 ${uniqueIds.size} >= ${minThreshold}`);
  } else {
    console.log(`[FAIL] 失败: 去重行数 ${uniqueIds.size} < ${minThreshold}`);
    // 对于negative类型，如果未达到5000，给出警告但不抛出错误（允许fallback继续）
    if (corpusType === 'negative' && result.summary?.fallback_used) {
      console.log(`[WARNING] 已使用fallback机制，但未达到目标数量`);
      console.log(`建议: 检查GitHub API速率限制或增加查询模板`);
    } else {
      throw new Error(`验收失败: 去重行数 ${uniqueIds.size} < ${minThreshold}`);
    }
  }

  if (result.totalDeduped >= minThreshold) {
    console.log(`[PASS] 通过: 去重后数量 ${result.totalDeduped} >= ${minThreshold}`);
  } else {
    console.log(`[FAIL] 失败: 去重后数量 ${result.totalDeduped} < ${minThreshold}`);
    // 对于negative类型，如果未达到5000，给出警告但不抛出错误（允许fallback继续）
    if (corpusType === 'negative' && result.summary?.fallback_used) {
      console.log(`[WARNING] 已使用fallback机制，但未达到目标数量`);
      console.log(`建议: 检查GitHub API速率限制或增加查询模板`);
    } else {
      throw new Error(`验收失败: 去重后数量 ${result.totalDeduped} < ${minThreshold}`);
    }
  }

  console.log('\n[PASS] 所有验收检查通过！');
}

/**
 * 主函数
 */
async function main() {
  try {
    const { targetCount, includeComments, maxCommentsPerItem, corpusType } = parseArgs();

    // 显示 .env 文件位置提示
    console.log('\n[提示] 查找 .env 文件的位置:');
    for (const envPath of envPaths) {
      const exists = fs.existsSync(envPath);
      console.log(`  ${exists ? '✓' : '✗'} ${envPath}`);
    }

    // 检查GITHUB_TOKEN
    if (!process.env.GITHUB_TOKEN) {
      console.warn(
        '\n警告: 未设置 GITHUB_TOKEN 环境变量。\n' +
        'GitHub API 有速率限制，建议设置 token 以提高速率限制。\n' +
        '可以在 .env 文件中设置: GITHUB_TOKEN=your_token_here\n'
      );
    }

    // 检查认证信息
    if (!JWT_TOKEN && !API_PASSWORD) {
      console.warn(
        '\n提示: 未设置认证信息。\n' +
        '可以在 .env 文件中设置以下之一：\n' +
        '  - JWT_TOKEN=your_jwt_token (直接提供token)\n' +
        '  - API_USERNAME=username 和 API_PASSWORD=password (自动登录)\n' +
        '\n或者运行以下命令获取帮助：\n' +
        '  node scripts/get-auth-info.js --get-token\n'
      );
    }

    const result = await exportCorpus(targetCount, includeComments, maxCommentsPerItem, corpusType);
    validateExport(result);

    console.log('\n' + '='.repeat(60));
    console.log('导出成功完成！');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    if (error.stack) {
      console.error('\n堆栈跟踪:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { exportCorpus, validateExport };

