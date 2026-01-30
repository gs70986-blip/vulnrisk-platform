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
            
            <!-- High-Severity Similarity (Raw) -->
            <el-descriptions-item label="High-Severity Similarity (Raw)">
              <div style="display: flex; align-items: center; gap: 8px">
                <el-progress
                  :percentage="(effectivePVulnRaw * 100)"
                  :color="getRiskColor(effectivePVulnRaw)"
                  :stroke-width="20"
                />
                <span>{{ formatPercent(effectivePVulnRaw) }}</span>
                <el-tag v-if="prediction.isClipped" type="warning" size="small">
                  Low Confidence
                </el-tag>
                <el-tag v-else-if="effectiveReliability === 'Low'" type="warning" size="small">
                  Clipped
                </el-tag>
              </div>
            </el-descriptions-item>

            <!-- Reliability Badge -->
            <el-descriptions-item label="Reliability">
              <el-tag :type="getReliabilityTagType(effectiveReliability)" size="large">
                {{ effectiveReliability }}
              </el-tag>
            </el-descriptions-item>

            <el-descriptions-item label="CVSS Base Score">
              {{
                prediction.cvss !== null && prediction.cvss !== undefined
                  ? prediction.cvss.toFixed(2)
                  : 'N/A'
              }}
            </el-descriptions-item>
            
            <el-descriptions-item label="Risk Score">
              <el-progress
                :percentage="(prediction.riskScore || 0) * 100"
                :color="getRiskColor(prediction.riskScore || 0)"
                :stroke-width="20"
              />
              {{ formatRiskScore(prediction.riskScore) }}
            </el-descriptions-item>
            
            <el-descriptions-item label="Risk Level">
              <el-tag :type="getRiskTagType(effectiveRiskLevel)" size="large">
                {{ effectiveRiskLevel }}
              </el-tag>
              <span v-if="effectiveRiskLevel === 'Unknown'" style="margin-left: 8px; color: #909399; font-size: 12px">
                (Severity estimation uncertain)
              </span>
            </el-descriptions-item>
            
            <el-descriptions-item label="Model">
              {{ prediction.model?.type || 'N/A' }}
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

      <!-- Evidence in Text -->
      <el-divider>Evidence in Text</el-divider>
      <el-card>
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
              <strong>Assessment Methodology:</strong><br />
              This system predicts risk severity based on text similarity to training data, not vulnerability detection.
              The <code>pVulnRaw</code> value represents statistical similarity to high-severity samples in the training corpus,
              not the actual probability of a vulnerability existing.<br /><br />
              
              <strong>Reliability Considerations:</strong><br />
              When input text lacks detailed exploitability or impact information, or shows low similarity to training data,
              the reliability of the assessment decreases. Low-confidence results should be interpreted with caution and
              may require manual review.<br /><br />
              
              <strong>Limitations:</strong><br />
              This system is designed for risk assessment and prioritization, not for definitive vulnerability detection.
              Always perform manual security review for critical systems.
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
import { predictionApi, modelApi, type Prediction, type MLModel } from '../services/api'
import { extractRiskEvidence, type RiskEvidenceResult } from '../services/riskEvidence'
import { getRiskTypeColor } from '../config/riskTaxonomy'

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
