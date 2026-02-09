-- 查看所有表
\dt

-- 查看预测结果总数
SELECT COUNT(*) as total_predictions FROM predictions;

-- 查看模型列表
SELECT id, type, "isActive", "createdAt" FROM ml_models ORDER BY "createdAt" DESC;

-- 查看最近的5条预测结果
SELECT id, "sampleId", "pVuln", "riskLevel", "createdAt" FROM predictions ORDER BY "createdAt" DESC LIMIT 5;

-- 查看预测结果的严重程度分布
SELECT "riskLevel", COUNT(*) as count FROM predictions GROUP BY "riskLevel" ORDER BY count DESC;

-- 查看预测结果的详细信息（包含 metadata）
-- 优先使用新字段，兼容旧字段
SELECT 
    id, 
    "sampleId", 
    "pVuln", 
    "riskLevel", 
    "riskScore",
    COALESCE(metadata->>'isVulnRelated', metadata->>'applicable') as isVulnRelated,
    COALESCE(metadata->>'pVulnRelated', metadata->>'pApplicable') as pVulnRelated,
    metadata->>'applicable' as applicable,  -- 旧字段（兼容）
    metadata->>'pApplicable' as pApplicable,  -- 旧字段（兼容）
    metadata->>'severityLevel' as severityLevel,
    "createdAt"
FROM predictions 
ORDER BY "createdAt" DESC 
LIMIT 10;

