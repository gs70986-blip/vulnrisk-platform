/**
 * 预测结果字段映射工具
 * 用于统一处理新旧字段的兼容性
 */

export interface PredictionData {
  // 旧字段
  pVuln?: number | null;
  riskLevel?: string | null;
  riskScore?: number | null;
  cvss?: number | null;
  reliability?: string | null;
  
  // 新字段（两阶段模型）- 主字段
  pVulnRelated?: number | null;
  isVulnRelated?: boolean | null;
  // 旧字段（兼容，值与新字段相同）
  pApplicable?: number | null;
  applicable?: boolean | null;
  severityLevel?: string | null;
  severityProbs?: {
    Low?: number;
    Medium?: number;
    High?: number;
    Critical?: number;
  } | null;
  
  // 元数据
  meta?: any;
}

/**
 * 获取显示的风险等级
 * 优先使用 riskLevel（从 risk_score 映射得到的），而不是 severityLevel（Stage B 模型预测的严重度等级）
 */
export function getDisplayRiskLevel(prediction: PredictionData): string {
  return prediction.riskLevel ?? prediction.severityLevel ?? 'N/A';
}

/**
 * 获取显示的风险评分
 */
export function getDisplayRiskScore(prediction: PredictionData): number {
  return prediction.riskScore ?? 0;
}

/**
 * 获取显示的适用性概率（优先新字段，兼容旧字段）
 */
export function getDisplayApplicableProb(prediction: PredictionData): number | null {
  return prediction.pVulnRelated ?? prediction.pApplicable ?? null;
}

/**
 * 获取显示的高风险概率（P(High) + P(Critical)）
 */
export function getDisplayHighRiskProb(prediction: PredictionData): number | null {
  if (prediction.severityProbs) {
    return (prediction.severityProbs.High || 0) + (prediction.severityProbs.Critical || 0);
  }
  // 兼容旧字段
  if (prediction.pVuln !== null && prediction.pVuln !== undefined) {
    return prediction.pVuln;
  }
  return null;
}

/**
 * 获取是否适用（优先新字段，兼容旧字段）
 */
export function getDisplayApplicable(prediction: PredictionData): boolean {
  return prediction.isVulnRelated ?? prediction.applicable ?? true;
}

/**
 * 获取严重度概率分布
 */
export function getSeverityProbs(prediction: PredictionData): {
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
} | null {
  if (prediction.severityProbs) {
    return {
      Low: prediction.severityProbs.Low || 0,
      Medium: prediction.severityProbs.Medium || 0,
      High: prediction.severityProbs.High || 0,
      Critical: prediction.severityProbs.Critical || 0,
    };
  }
  return null;
}



