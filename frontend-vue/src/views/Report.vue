<template>
  <div class="report-page">
    <el-card v-if="prediction">
      <template #header>
        <div class="card-header">
          <span>Risk Assessment Report</span>
          <el-button @click="$router.back()">Back</el-button>
        </div>
      </template>

      <!-- Warnings Alert -->
      <el-alert
        v-if="prediction.warnings && prediction.warnings.length > 0"
        :title="prediction.warnings[0]"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 20px"
      >
        <template v-if="prediction.warnings.length > 1">
          <ul style="margin: 8px 0 0 0; padding-left: 20px">
            <li v-for="(warning, idx) in prediction.warnings.slice(1)" :key="idx">
              {{ warning }}
            </li>
          </ul>
        </template>
      </el-alert>

      <el-row :gutter="20">
        <!-- Left Column: Prediction Details -->
        <el-col :span="12">
          <el-descriptions title="Prediction Details" :column="1" border>
            <el-descriptions-item label="Sample ID">
              {{ prediction.sampleId }}
            </el-descriptions-item>
            
            <!-- Vuln-Related (漏洞相关性) -->
            <el-descriptions-item label="Vuln-Related">
              <div style="display: flex; align-items: center; gap: 8px">
                <el-tag :type="getIsVulnRelated(prediction) ? 'success' : 'info'" size="large">
                  {{ getIsVulnRelated(prediction) ? 'Vuln-Related' : 'Not Vuln-Related' }}
                </el-tag>
                <span v-if="getPVulnRelated(prediction) !== null && getPVulnRelated(prediction) !== undefined">
                  ({{ formatPercent(getPVulnRelated(prediction)) }})
                </span>
                <el-tooltip 
                  content="Probability that the input text is vulnerability-related (Stage A decision)."
                  placement="top"
                >
                  <el-icon style="cursor: help; color: #909399;"><QuestionFilled /></el-icon>
                </el-tooltip>
              </div>
            </el-descriptions-item>

            <!-- Severity Level -->
            <el-descriptions-item v-if="shouldShowSeverityInfo" label="Severity Level">
              <el-tag :type="getRiskTagType(displayRiskLevel)" size="large">
                {{ displayRiskLevel }}
              </el-tag>
            </el-descriptions-item>
            
            <!-- Risk Score (Reference) -->
            <el-descriptions-item v-if="shouldShowSeverityInfo" label="Risk Score (Reference)">
              <el-progress
                :percentage="(prediction.riskScore || 0) * 100"
                :color="getRiskColor(prediction.riskScore || 0)"
                :stroke-width="20"
              />
              {{ formatRiskScore(prediction.riskScore) }}
            </el-descriptions-item>
            
            <!-- Risk Level -->
            <el-descriptions-item label="Risk Level">
              <el-tag :type="getRiskTagType(displayRiskLevel)" size="large">
                {{ displayRiskLevel }}
              </el-tag>
              <span v-if="displayRiskLevel === 'Unknown' || displayRiskLevel === 'N/A'" style="margin-left: 8px; color: #909399; font-size: 12px">
                (Severity estimation uncertain)
              </span>
            </el-descriptions-item>

            <!-- Reliability Badge -->
            <el-descriptions-item label="Reliability">
              <el-tag :type="getReliabilityTagType(effectiveReliability)" size="large">
                {{ effectiveReliability }}
              </el-tag>
            </el-descriptions-item>
            
            <el-descriptions-item label="Model">
              <div v-if="prediction.severityProbs && prediction.modelInfo">
                <div>Severity Model: {{ getModelName(prediction.modelInfo.severityModel) }}</div>
                <div style="font-size: 12px; color: #909399; margin-top: 4px">
                  Relevance Model: {{ getModelName(prediction.modelInfo.relevanceModel || prediction.modelInfo.applicabilityModel) }}
                </div>
              </div>
              <span v-else>{{ prediction.model?.type || 'N/A' }}</span>
            </el-descriptions-item>
            
            <el-descriptions-item label="Created At">
              {{ formatDate(prediction.createdAt) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-col>

        <!-- Right Column: Reliability & Notes -->
        <el-col :span="12">
          <el-card>
            <template #header>
              <span>Reliability & Notes</span>
            </template>
            
            <div v-if="prediction.explanation" style="margin-bottom: 16px">
              <el-text type="info" size="small" style="display: block; margin-bottom: 8px">
                Assessment Note:
              </el-text>
              <el-text>{{ prediction.explanation }}</el-text>
            </div>

            <div v-if="effectiveReliability">
              <el-text type="info" size="small" style="display: block; margin-bottom: 8px">
                Reliability Level:
              </el-text>
              <el-text>
                <strong>{{ effectiveReliability }}</strong> - 
                <span v-if="effectiveReliability === 'High'">
                  High confidence assessment based on strong evidence.
                </span>
                <span v-else-if="effectiveReliability === 'Medium'">
                  Medium confidence assessment. Results should be interpreted with caution.
                </span>
                <span v-else>
                  Low confidence assessment due to insufficient evidence. Results are for reference only.
                </span>
              </el-text>
            </div>

            <div v-if="prediction.meta?.max_similarity !== null && prediction.meta?.max_similarity !== undefined" style="margin-top: 16px">
              <el-text type="info" size="small" style="display: block; margin-bottom: 8px">
                Technical Details:
              </el-text>
              <el-text size="small">
                Max Similarity: {{ (prediction.meta.max_similarity * 100).toFixed(2) }}%<br>
                Non-zero Features: {{ prediction.meta.nonzero_features || 'N/A' }}
              </el-text>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- Severity Probability Distribution -->
      <el-divider v-if="shouldShowSeverityInfo && prediction.severityProbs">Severity Probability Distribution</el-divider>
      <el-card v-if="shouldShowSeverityInfo && prediction.severityProbs">
        <div style="height: 300px">
          <v-chart :option="severityChartOption" style="height: 100%" />
        </div>
        <el-text type="info" size="small" style="display: block; margin-top: 12px; text-align: center">
          This distribution represents the learned probability estimates for each severity level, 
          conditional on the input being vulnerability-related. The predicted severity level is determined by the highest probability.
        </el-text>
      </el-card>

      <!-- Keyword Indicators (Heuristic) -->
      <el-divider>Keyword Indicators (Heuristic)</el-divider>
      <el-card>
        <el-text type="info" size="small" style="display: block; margin-bottom: 12px; font-style: italic">
          Extracted via rule-based matching, not a model explanation
        </el-text>
        <div v-if="riskEvidence.hasEvidence">
          <div style="margin-bottom: 16px">
            <el-text type="primary" style="font-weight: bold; margin-right: 12px">
              Detected Risk Types:
            </el-text>
            <el-tag
              v-for="riskType in riskEvidence.riskTypes"
              :key="riskType.id"
              :style="{ backgroundColor: getRiskTypeColor(riskType.id), color: 'white', marginRight: '8px' }"
              size="default"
            >
              {{ riskType.name }}
            </el-tag>
          </div>

          <el-collapse v-model="activeEvidenceCollapse">
            <el-collapse-item
              v-for="(evidence, idx) in riskEvidence.evidences"
              :key="idx"
              :title="`${evidence.riskType.name}: '${evidence.keyword}'`"
              :name="idx"
            >
              <div>
                <el-text type="info" size="small" style="display: block; margin-bottom: 8px">
                  Context:
                </el-text>
                <el-text style="font-family: monospace; background: #f5f7fa; padding: 8px; display: block; border-radius: 4px">
                  ...{{ evidence.snippet }}...
                </el-text>
                
                <el-divider style="margin: 12px 0" />
                
                <el-text type="info" size="small" style="display: block; margin-bottom: 8px">
                  Explanation:
                </el-text>
                <el-text>{{ evidence.riskType.explanation }}</el-text>
                
                <el-text type="info" size="small" style="display: block; margin-top: 12px; margin-bottom: 8px">
                  Recommended Actions:
                </el-text>
                <ul style="margin: 0; padding-left: 20px">
                  <li v-for="(action, actionIdx) in evidence.riskType.recommendedActions.slice(0, 2)" :key="actionIdx">
                    <el-text size="small">{{ action }}</el-text>
                  </li>
                </ul>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
        <div v-else>
          <el-empty description="No specific risk evidence detected" :image-size="100">
            <el-text type="info" size="small">
              The input text does not contain clear indicators of known vulnerability types.
              <br />
              <strong>Note:</strong> This may indicate insufficient evidence for risk assessment.
            </el-text>
          </el-empty>
        </div>
      </el-card>

      <!-- Original Text Description -->
      <el-divider>Original Text Description</el-divider>
      <el-card>
        <p style="white-space: pre-wrap; word-break: break-word; margin: 0">
          {{ prediction.textDescription || 'N/A' }}
        </p>
      </el-card>

      <!-- Method Note -->
      <el-divider />
      <el-collapse v-model="activeMethodNote">
        <el-collapse-item title="Method Note" name="method">
          <div style="line-height: 1.8">
            <el-text>
              <strong>Two-Stage Assessment Methodology:</strong><br />
              <strong>Stage A</strong> determines vulnerability relevance (whether the input text is vulnerability-related and enters risk assessment).<br />
              <strong>Stage B</strong> predicts severity distribution (Low/Medium/High/Critical) for applicable inputs, conditional on Stage A passing.<br /><br />
              
              <strong>Risk Assessment Semantics:</strong><br />
              The risk assessment is conditional on applicability. The severity probability distribution represents learned patterns 
              for prioritization under uncertainty, not definitive vulnerability existence. The risk score is a reference estimate 
              for prioritization purposes.<br /><br />
              
              <strong>Reliability Considerations:</strong><br />
              When input text lacks detailed exploitability or impact information, or shows low similarity to training data,
              the reliability of the assessment decreases. Low-confidence results should be interpreted with caution and
              may require manual review.<br /><br />
              
              <strong>Limitations:</strong><br />
              This system does not compute official CVSS scores. Always perform manual security review for critical systems.
            </el-text>
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <el-empty v-else description="Report not found" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { predictionApi, modelApi, type Prediction, type MLModel } from '../services/api'
import { extractRiskEvidence, type RiskEvidenceResult } from '../services/riskEvidence'
import { getRiskTypeColor } from '../config/riskTaxonomy'
import { 
  getDisplayRiskLevel, 
  getDisplayHighRiskProb 
} from '../utils/predictionMapper'

use([
  CanvasRenderer,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
])

const route = useRoute()
const prediction = ref<Prediction | null>(null)
const riskEvidence = ref<RiskEvidenceResult>({
  riskTypes: [],
  evidences: [],
  hasEvidence: false,
})
const activeEvidenceCollapse = ref<number[]>([])
const activeMethodNote = ref<string[]>([])

// 计算有效值
const effectivePVulnRaw = computed(() => {
  // 优先使用pVulnRaw，如果没有则使用pVuln
  return prediction.value?.pVulnRaw ?? prediction.value?.pVuln ?? 0
})

const effectiveReliability = computed(() => {
  // 优先使用后端返回的reliability，否则根据pVulnRaw估算
  if (prediction.value?.reliability) {
    return prediction.value.reliability
  }
  
  const pVulnRaw = effectivePVulnRaw.value
  if (pVulnRaw < 0.1) {
    return 'Low'
  } else if (pVulnRaw < 0.3) {
    return 'Medium'
  } else {
    return 'High'
  }
})

const effectiveRiskLevel = computed(() => {
  // 如果riskLevel是N/A，前端强制映射为Unknown
  const level = prediction.value?.riskLevel || 'Unknown'
  return level === 'N/A' ? 'Unknown' : level
})

const displayRiskLevel = computed(() => {
  if (!prediction.value) return 'N/A'
  return getDisplayRiskLevel(prediction.value)
})

const effectiveHighRiskProb = computed(() => {
  if (!prediction.value) return 0
  const highRiskProb = getDisplayHighRiskProb(prediction.value)
  if (highRiskProb !== null) return highRiskProb
  // Fallback to pVulnRaw or pVuln
  return effectivePVulnRaw.value
})

const getSeverityColor = (level: string) => {
  switch (level) {
    case 'Critical':
      return '#f56c6c'
    case 'High':
      return '#e6a23c'
    case 'Medium':
      return '#f0c020'
    case 'Low':
      return '#67c23a'
    default:
      return '#909399'
  }
}

const loadReport = async () => {
  const id = route.params.id as string
  try {
    prediction.value = await predictionApi.getById(id)
    
    // 提取风险证据
    if (prediction.value?.textDescription) {
      riskEvidence.value = extractRiskEvidence(prediction.value.textDescription)
    }
  } catch (error: any) {
    ElMessage.error(`Failed to load report: ${error.message}`)
  }
}

const formatPercent = (value: number) => {
  return (value * 100).toFixed(2) + '%'
}

const formatRiskScore = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return 'N/A'
  }
  return (value * 100).toFixed(2)
}

const getRiskColor = (value: number) => {
  if (value < 0.4) return '#67c23a'
  if (value < 0.7) return '#e6a23c'
  if (value < 0.9) return '#f56c6c'
  return '#f56c6c'
}

const getRiskTagType = (level: string) => {
  const types: Record<string, string> = {
    Low: 'success',
    Medium: 'warning',
    High: 'danger',
    Critical: 'danger',
    Unknown: 'info',
  }
  return types[level] || 'info'
}

const getReliabilityTagType = (reliability: string) => {
  const types: Record<string, string> = {
    High: 'success',
    Medium: 'warning',
    Low: 'danger',
  }
  return types[reliability] || 'info'
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

// 获取是否漏洞相关（优先新字段，兼容旧字段）
const getIsVulnRelated = (pred: any): boolean => {
  return pred.isVulnRelated ?? pred.applicable ?? true
}

// 获取漏洞相关性概率（优先新字段，兼容旧字段）
const getPVulnRelated = (pred: any): number | null => {
  return pred.pVulnRelated ?? pred.pApplicable ?? null
}

// 判断是否应该显示严重度信息（优先新字段，兼容旧字段）
const shouldShowSeverityInfo = computed(() => {
  if (!prediction.value) return false
  const isVulnRelated = getIsVulnRelated(prediction.value)
  const applicable = isVulnRelated !== false
  const riskLevel = displayRiskLevel.value
  return applicable && riskLevel !== 'N/A' && riskLevel !== 'Unknown'
})

// 从模型路径提取模型名称
const getModelName = (modelPath: string | null | undefined): string => {
  if (!modelPath) return 'N/A'
  // 从路径中提取模型名称，例如 "models/app_model_001_xgb" -> "app_model_001_xgb"
  const parts = modelPath.split('/')
  return parts[parts.length - 1] || modelPath
}

// 严重度概率分布图表配置
const severityChartOption = computed(() => {
  if (!prediction.value?.severityProbs) {
    return {}
  }
  
  const probs = prediction.value.severityProbs
  const levels = ['Low', 'Medium', 'High', 'Critical']
  const colors = ['#67c23a', '#f0c020', '#e6a23c', '#f56c6c']
  
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        const param = params[0]
        return `${param.name}<br/>${param.seriesName}: ${(param.value * 100).toFixed(2)}%`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: levels,
      axisLabel: {
        fontWeight: 'bold'
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: {
        formatter: (value: number) => (value * 100).toFixed(0) + '%'
      }
    },
    series: [
      {
        name: 'Probability',
        type: 'bar',
        data: levels.map((level, index) => ({
          value: probs[level as keyof typeof probs] || 0,
          itemStyle: {
            color: colors[index]
          }
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => (params.value * 100).toFixed(1) + '%'
        }
      }
    ]
  }
})

onMounted(() => {
  loadReport()
})
</script>

<style scoped>
.report-page {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

code {
  background-color: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}
</style>
