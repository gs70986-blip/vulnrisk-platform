<template>
  <div class="report-page">
    <el-card v-if="prediction">
      <template #header>
        <div class="card-header">
          <span>Risk Report</span>
          <el-button @click="$router.back()">Back</el-button>
        </div>
      </template>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-descriptions title="Prediction Details" :column="1" border>
            <el-descriptions-item label="Sample ID">
              {{ prediction.sampleId }}
            </el-descriptions-item>
            <el-descriptions-item label="P(vuln)">
              <el-progress
                :percentage="prediction.pVuln * 100"
                :color="getRiskColor(prediction.pVuln)"
              />
              {{ formatPercent(prediction.pVuln) }}
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
                :percentage="prediction.riskScore * 100"
                :color="getRiskColor(prediction.riskScore)"
                :stroke-width="20"
              />
              {{ formatRiskScore(prediction.riskScore) }}
            </el-descriptions-item>
            <el-descriptions-item label="Risk Level">
              <el-tag :type="getRiskTagType(prediction.riskLevel)" size="large">
                {{ prediction.riskLevel }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Model">
              {{ prediction.model?.type || 'N/A' }}
            </el-descriptions-item>
            <el-descriptions-item label="Created At">
              {{ formatDate(prediction.createdAt) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-col>

        <el-col :span="12">
          <el-card>
            <template #header>
              <span>Risk Breakdown</span>
            </template>
            <div style="height: 300px">
              <v-chart :option="riskChartOption" style="height: 100%" />
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-divider>Original Text Description</el-divider>
      <el-card>
        <p style="white-space: pre-wrap; word-break: break-word">
          {{ prediction.textDescription || 'N/A' }}
        </p>
      </el-card>

      <el-divider v-if="modelMetadata?.feature_importance?.length">
        Top Features Importance
      </el-divider>
      <el-card v-if="modelMetadata?.feature_importance?.length">
        <div style="height: 400px">
          <v-chart :option="featuresChartOption" style="height: 100%" />
        </div>
      </el-card>
    </el-card>

    <el-empty v-else description="Report not found" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { predictionApi, modelApi, type Prediction, type MLModel } from '../services/api'

use([
  CanvasRenderer,
  BarChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
])

const route = useRoute()
const prediction = ref<Prediction | null>(null)
const modelMetadata = ref<any>(null)

const loadReport = async () => {
  const id = route.params.id as string
  try {
    prediction.value = await predictionApi.getById(id)
    
    // Load model metadata if available
    if (prediction.value.modelId) {
      try {
        const model = await modelApi.getById(prediction.value.modelId)
        modelMetadata.value = model.metadata || {}
      } catch (error) {
        console.error('Failed to load model metadata:', error)
      }
    }
  } catch (error: any) {
    ElMessage.error(`Failed to load report: ${error.message}`)
  }
}

const riskChartOption = computed(() => {
  if (!prediction.value) return {}

  const pVuln = prediction.value.pVuln
  const cvss = prediction.value.cvss
  const riskScore = prediction.value.riskScore

  return {
    title: {
      text: 'Risk Components',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
      data: ['P(vuln)', 'CVSS/10', 'Risk Score'],
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
    },
    series: [
      {
        name: 'Score',
        type: 'bar',
        data: [
          pVuln,
          cvss !== null && cvss !== undefined ? cvss / 10 : 0,
          riskScore,
        ],
        itemStyle: {
          color: function (params: any) {
            const colors = ['#409eff', '#67c23a', '#e6a23c']
            return colors[params.dataIndex] || '#909399'
          },
        },
      },
    ],
  }
})

const featuresChartOption = computed(() => {
  if (!modelMetadata.value?.feature_importance?.length) return {}

  const features = modelMetadata.value.feature_importance
    .slice(0, 15)
    .reverse()

  return {
    title: {
      text: 'Top 15 Feature Importance',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'value',
    },
    yAxis: {
      type: 'category',
      data: features.map((f: any) => f.name),
    },
    series: [
      {
        name: 'Importance',
        type: 'bar',
        data: features.map((f: any) => f.importance),
        itemStyle: {
          color: '#409eff',
        },
      },
    ],
  }
})

const formatPercent = (value: number) => {
  return (value * 100).toFixed(2) + '%'
}

const formatRiskScore = (value: number) => {
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
  }
  return types[level] || 'info'
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
</style>









