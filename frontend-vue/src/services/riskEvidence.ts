/**
 * 风险证据提取服务
 * 从文本中提取风险类型和证据
 */

import { riskTaxonomy, matchRiskTypes, type RiskType } from '../config/riskTaxonomy'

export interface RiskEvidence {
  keyword: string
  snippet: string
  context: string
  riskType: RiskType
}

export interface RiskEvidenceResult {
  riskTypes: RiskType[]
  evidences: RiskEvidence[]
  hasEvidence: boolean
}

/**
 * 从文本中提取风险证据
 * @param text 输入文本
 * @returns 风险证据结果
 */
export function extractRiskEvidence(text: string): RiskEvidenceResult {
  if (!text || text.trim().length === 0) {
    return {
      riskTypes: [],
      evidences: [],
      hasEvidence: false,
    }
  }

  const lowerText = text.toLowerCase()
  const matchedRiskTypes = matchRiskTypes(text)
  const evidences: RiskEvidence[] = []

  // 为每个匹配的风险类型提取证据
  for (const riskType of matchedRiskTypes) {
    for (const keyword of riskType.keywords) {
      const keywordLower = keyword.toLowerCase()
      const index = lowerText.indexOf(keywordLower)

      if (index !== -1) {
        // 提取关键词周围的上下文（前后各50个字符）
        const start = Math.max(0, index - 50)
        const end = Math.min(text.length, index + keyword.length + 50)
        const snippet = text.substring(start, end)
        const context = text.substring(
          Math.max(0, index - 100),
          Math.min(text.length, index + keyword.length + 100)
        )

        // 避免重复添加相同关键词的证据
        if (!evidences.find(e => e.keyword === keyword && e.riskType.id === riskType.id)) {
          evidences.push({
            keyword,
            snippet: snippet.trim(),
            context: context.trim(),
            riskType,
          })
        }
      }
    }
  }

  return {
    riskTypes: matchedRiskTypes,
    evidences,
    hasEvidence: matchedRiskTypes.length > 0,
  }
}

/**
 * 高亮文本中的关键词
 * @param text 原始文本
 * @param keywords 要高亮的关键词列表
 * @returns 高亮后的HTML字符串
 */
export function highlightKeywords(text: string, keywords: string[]): string {
  let highlighted = text
  const lowerText = text.toLowerCase()

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase()
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    
    if (lowerText.includes(keywordLower)) {
      highlighted = highlighted.replace(
        regex,
        '<mark style="background-color: #fff3cd; padding: 2px 4px; border-radius: 2px;">$1</mark>'
      )
    }
  }

  return highlighted
}

/**
 * 获取所有匹配的关键词（去重）
 */
export function getAllMatchedKeywords(text: string): string[] {
  const result = extractRiskEvidence(text)
  const keywords = new Set<string>()

  for (const evidence of result.evidences) {
    keywords.add(evidence.keyword)
  }

  return Array.from(keywords)
}




