<template>
  <div class="models-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <div>ML Models</div>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            style="display: flex; margin: 0;"
          >
            <template #default>
              Models are pre-trained by the system. Select a model to activate it for predictions.
            </template>
          </el-alert>
        </div>
      </template>

      <el-table :data="models" style="width: 100%" v-loading="loading">
        <el-table-column prop="type" label="Type" width="150" />
        <el-table-column label="Metrics" width="400">
          <template #default="scope">
            <div class="metrics">
              <span>Accuracy: {{ formatMetric(scope.row.metrics?.accuracy) }}</span>
              <span>Precision: {{ formatMetric(scope.row.metrics?.precision) }}</span>
              <span>Recall: {{ formatMetric(scope.row.metrics?.recall) }}</span>
              <span>F1: {{ formatMetric(scope.row.metrics?.f1) }}</span>
              <span>ROC-AUC: {{ formatMetric(scope.row.metrics?.roc_auc) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Status" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.isActive ? 'success' : 'info'">
              {{ scope.row.isActive ? 'Active' : 'Inactive' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="Created At" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="200">
          <template #default="scope">
            <el-button
              v-if="!scope.row.isActive"
              size="small"
              type="primary"
              @click="activateModel(scope.row.id)"
            >
              Activate
            </el-button>
            <el-button
              v-else
              size="small"
              type="success"
              disabled
            >
              Active
            </el-button>
            <el-button
              size="small"
              @click="viewModelDetails(scope.row)"
              style="margin-left: 8px"
            >
              Details
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Model Details Dialog -->
    <el-dialog v-model="showDetailsDialog" title="Model Details" width="700px">
      <div v-if="selectedModel">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="Type">{{ selectedModel.type }}</el-descriptions-item>
          <el-descriptions-item label="Status">
            <el-tag :type="selectedModel.isActive ? 'success' : 'info'">
              {{ selectedModel.isActive ? 'Active' : 'Inactive' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Accuracy">
            {{ formatMetric(selectedModel.metrics?.accuracy) }}
          </el-descriptions-item>
          <el-descriptions-item label="Precision">
            {{ formatMetric(selectedModel.metrics?.precision) }}
          </el-descriptions-item>
          <el-descriptions-item label="Recall">
            {{ formatMetric(selectedModel.metrics?.recall) }}
          </el-descriptions-item>
          <el-descriptions-item label="F1 Score">
            {{ formatMetric(selectedModel.metrics?.f1) }}
          </el-descriptions-item>
          <el-descriptions-item label="ROC-AUC">
            {{ formatMetric(selectedModel.metrics?.roc_auc) }}
          </el-descriptions-item>
          <el-descriptions-item label="Created At">
            {{ formatDate(selectedModel.createdAt) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>Metrics Chart</el-divider>
        <div style="height: 300px">
          <v-chart :option="metricsChartOption" style="height: 100%" />
        </div>

        <el-divider v-if="selectedModel.metadata?.feature_importance?.length">
          Top Features
        </el-divider>
        <el-table
          v-if="selectedModel.metadata?.feature_importance?.length"
          :data="selectedModel.metadata.feature_importance.slice(0, 10)"
          style="width: 100%"
        >
          <el-table-column prop="name" label="Feature Name" />
          <el-table-column prop="importance" label="Importance">
            <template #default="scope">
              {{ formatMetric(scope.row.importance) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
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
import { modelApi, type MLModel } from '../services/api'

use([
  CanvasRenderer,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
])

const models = ref<MLModel[]>([])
const loading = ref(false)
const showDetailsDialog = ref(false)
const selectedModel = ref<MLModel | null>(null)

const metricsChartOption = computed(() => {
  if (!selectedModel.value) return {}
  
  const metrics = selectedModel.value.metrics as {
    accuracy?: number
    precision?: number
    recall?: number
    f1?: number
    roc_auc?: number
  } || {}
  
  return {
    title: {
      text: 'Model Metrics',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
      data: ['Accuracy', 'Precision', 'Recall', 'F1', 'ROC-AUC'],
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
          metrics.accuracy || 0,
          metrics.precision || 0,
          metrics.recall || 0,
          metrics.f1 || 0,
          metrics.roc_auc || 0,
        ],
        itemStyle: {
          color: '#409eff',
        },
      },
    ],
  }
})

const loadModels = async () => {
  loading.value = true
  try {
    models.value = await modelApi.getAll()
  } catch (error: any) {
    ElMessage.error(`Failed to load models: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const activateModel = async (id: string) => {
  try {
    await modelApi.activate(id)
    ElMessage.success('Model activated successfully')
    await loadModels()
  } catch (error: any) {
    ElMessage.error(`Failed to activate model: ${error.message}`)
  }
}

const viewModelDetails = (model: MLModel) => {
  selectedModel.value = model
  showDetailsDialog.value = true
}

const formatMetric = (value: number | undefined) => {
  if (value === undefined || value === null) return 'N/A'
  return (value * 100).toFixed(2) + '%'
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

onMounted(() => {
  loadModels()
})
</script>

<style scoped>
.models-page {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
}

.metrics span {
  padding: 2px 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
}
</style>







