<template>
  <div class="predictions-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>Predictions</span>
          <div style="display: flex; gap: 10px;">
            <el-dropdown @command="handleExport" :disabled="predictions.length === 0 || loading">
              <el-button type="info">
                <el-icon><Download /></el-icon>
                Export
                <el-icon class="el-icon--right"><ArrowDownIcon /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="csv">Export as CSV</el-dropdown-item>
                  <el-dropdown-item command="excel">Export as Excel</el-dropdown-item>
                  <el-dropdown-item command="json">Export as JSON</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button type="primary" @click="showSingleDialog = true">
              <el-icon><Plus /></el-icon>
              Single Prediction
            </el-button>
            <el-button type="success" @click="showBatchDialog = true">
              <el-icon><Upload /></el-icon>
              Batch Import
            </el-button>
          </div>
        </div>
      </template>

      <!-- Prediction History -->
      <el-table :data="predictions" style="width: 100%" v-loading="loading">
        <el-table-column prop="sampleId" label="Sample ID" width="200" />
        <el-table-column label="Text Description" min-width="250" show-overflow-tooltip>
          <template #default="scope">
            <span>{{ scope.row.textDescription || '-' }}</span>
            <el-tooltip 
              v-if="scope.row.riskLevel === 'N/A' && scope.row.explanation" 
              :content="scope.row.explanation" 
              placement="top"
            >
              <span style="color: #909399; cursor: help; font-size: 12px; margin-left: 5px;">ℹ️</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="P(vuln)" width="150">
          <template #default="scope">
            <el-progress
              :percentage="scope.row.pVuln * 100"
              :color="getRiskColor(scope.row.pVuln)"
              :stroke-width="8"
            />
            <span style="margin-left: 8px">{{ formatPercent(scope.row.pVuln) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Risk Score" width="150">
          <template #default="scope">
            <el-progress
              :percentage="scope.row.riskScore * 100"
              :color="getRiskColor(scope.row.riskScore)"
              :stroke-width="8"
            />
            <span style="margin-left: 8px">{{ formatRiskScore(scope.row.riskScore) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Risk Level" width="200">
          <template #default="scope">
            <div style="display: flex; align-items: center; gap: 5px;">
              <el-tag :type="getRiskTagType(scope.row.riskLevel)">
                {{ scope.row.riskLevel }}
              </el-tag>
              <el-tooltip v-if="scope.row.explanation" :content="scope.row.explanation" placement="top">
                <span style="color: #909399; cursor: help; font-size: 12px;">ℹ️</span>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="cvss" label="CVSS" width="100">
          <template #default="scope">
            {{ scope.row.cvss !== null && scope.row.cvss !== undefined ? scope.row.cvss.toFixed(2) : 'N/A' }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="Created At" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="100">
          <template #default="scope">
            <el-button size="small" @click="viewReport(scope.row.id)">
              View
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div style="margin-top: 20px; text-align: right">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadPredictions"
          @current-change="loadPredictions"
        />
      </div>
    </el-card>

    <!-- Single Prediction Dialog -->
    <el-dialog v-model="showSingleDialog" title="Single Prediction" width="600px">
      <el-form :model="singleForm" label-width="140px" :rules="singleRules" ref="singleFormRef">
        <el-form-item label="Sample ID" prop="sample_id">
          <el-input v-model="singleForm.sample_id" placeholder="Enter sample ID" />
        </el-form-item>
        <el-form-item label="Text Description" prop="text_description">
          <el-input
            v-model="singleForm.text_description"
            type="textarea"
            :rows="5"
            placeholder="Enter vulnerability description"
          />
        </el-form-item>
        <el-form-item label="CVSS Base Score">
          <el-input-number
            v-model="singleForm.cvss_base_score"
            :min="0"
            :max="10"
            :precision="1"
            placeholder="Optional (0-10)"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSingleDialog = false">Cancel</el-button>
        <el-button type="primary" @click="submitSinglePrediction" :loading="predicting">
          Predict
        </el-button>
      </template>
    </el-dialog>

    <!-- Batch Prediction Dialog -->
    <el-dialog v-model="showBatchDialog" title="Batch Prediction" width="600px">
      <el-upload
        ref="batchUploadRef"
        :auto-upload="false"
        :limit="1"
        :on-change="handleBatchFileChange"
        :on-remove="handleBatchFileRemove"
        accept=".json,.csv,.xlsx,.xls"
        drag
        :disabled="predicting"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          Drop file here or <em>click to upload</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            <p style="margin: 5px 0; font-size: 12px; color: #909399;">
              <strong>Supported formats:</strong> JSON, CSV, Excel (.xlsx, .xls)
            </p>
            <p style="margin: 5px 0; font-size: 11px; color: #909399;">
              <strong>Required columns:</strong> sample_id (or id), text_description (or description)
            </p>
            <p style="margin: 5px 0; font-size: 11px; color: #909399;">
              <strong>Optional column:</strong> cvss_base_score (or cvss)
            </p>
            <details style="margin-top: 10px;">
              <summary style="cursor: pointer; color: #606266; font-size: 11px;">View format examples</summary>
              <div style="margin-top: 10px;">
                <p style="font-size: 11px; color: #606266; margin: 5px 0;"><strong>JSON:</strong></p>
                <pre style="margin: 5px 0; font-size: 10px; color: #606266; background: #f5f7fa; padding: 8px; border-radius: 4px; overflow-x: auto;">{
  "samples": [
    {
      "sample_id": "CVE-2024-0001",
      "text_description": "Vulnerability description...",
      "cvss_base_score": 7.5
    }
  ]
}</pre>
                <p style="font-size: 11px; color: #606266; margin: 5px 0;"><strong>CSV/Excel:</strong></p>
                <pre style="margin: 5px 0; font-size: 10px; color: #606266; background: #f5f7fa; padding: 8px; border-radius: 4px; overflow-x: auto;">sample_id,text_description,cvss_base_score
CVE-2024-0001,"Vulnerability description...",7.5</pre>
              </div>
            </details>
          </div>
        </template>
      </el-upload>

      <div v-if="batchFileInfo" style="margin-top: 20px">
        <el-alert
          :title="batchFileInfo.sampleCount > 0 
            ? `File: ${batchFileInfo.name} (${batchFileInfo.sampleCount} samples detected)` 
            : `File: ${batchFileInfo.name} (ready to process)`"
          type="success"
          :closable="false"
        />
        <div style="margin-top: 15px; text-align: center">
          <el-button
            type="primary"
            size="large"
            @click="submitBatchPrediction"
            :loading="predicting"
            :disabled="!batchFileInfo || !batchFileInfo.file"
          >
            <el-icon v-if="!predicting"><Upload /></el-icon>
            {{ predicting ? 'Predicting...' : 'Start Batch Prediction' }}
          </el-button>
        </div>
      </div>

      <template #footer>
        <el-button @click="closeBatchDialog">Cancel</el-button>
      </template>
    </el-dialog>

    <!-- GitHub Text Fetch Card -->
    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>GitHub 文本抓取（Issue/PR/Commit）</span>
        </div>
      </template>
      <div style="padding: 10px 0">
        <el-alert
          type="info"
          :closable="false"
          style="margin-bottom: 15px"
        >
          <template #default>
            <div style="font-size: 13px">
              <p style="margin: 0 0 5px 0">
                <strong>提示：</strong>建议粘贴真实 issue/PR/commit 文本作为模型输入；CVSS 可选
              </p>
              <p style="margin: 0; font-size: 12px; color: #909399">
                支持格式：
                <code style="background: #f5f7fa; padding: 2px 6px; border-radius: 3px; font-size: 11px">
                  https://github.com/{owner}/{repo}/issues/{number}
                </code>
                <code style="background: #f5f7fa; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 5px">
                  https://github.com/{owner}/{repo}/pull/{number}
                </code>
                <code style="background: #f5f7fa; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 5px">
                  https://github.com/{owner}/{repo}/commit/{sha}
                </code>
              </p>
            </div>
          </template>
        </el-alert>
        
        <el-tabs v-model="githubTab" style="margin-top: 10px">
          <!-- Single Fetch Tab -->
          <el-tab-pane label="单个抓取" name="single">
            <el-form :model="githubForm" label-width="0" style="margin-top: 15px">
              <el-form-item>
                <el-input
                  v-model="githubForm.url"
                  placeholder="粘贴 GitHub Issue/PR/Commit 链接"
                  :disabled="fetchingGithub"
                >
                  <template #append>
                    <el-button
                      type="primary"
                      @click="fetchGitHubText"
                      :loading="fetchingGithub"
                      :disabled="!githubForm.url"
                    >
                      抓取
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- Batch Fetch Tab -->
          <el-tab-pane label="批量抓取" name="batch">
            <el-form :model="githubBatchForm" label-width="0" style="margin-top: 15px">
              <el-form-item>
                <el-input
                  v-model="githubBatchForm.urls"
                  type="textarea"
                  :rows="8"
                  placeholder="每行粘贴一个 GitHub URL，支持 Issue/PR/Commit 链接&#10;例如：&#10;https://github.com/owner/repo/issues/123&#10;https://github.com/owner/repo/pull/456&#10;https://github.com/owner/repo/commit/abc1234"
                  :disabled="fetchingGithubBatch"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  @click="fetchGitHubTextBatch"
                  :loading="fetchingGithubBatch"
                  :disabled="!githubBatchForm.urls.trim()"
                  style="width: 100%"
                >
                  批量抓取
                </el-button>
              </el-form-item>
            </el-form>
            
            <!-- Batch Results -->
            <div v-if="githubBatchResults" style="margin-top: 20px">
              <el-alert
                :type="githubBatchResults.failureCount > 0 ? 'warning' : 'success'"
                :closable="false"
                style="margin-bottom: 15px"
              >
                <template #default>
                  <div style="font-size: 13px">
                    <p style="margin: 0">
                      抓取完成：成功 <strong>{{ githubBatchResults.successCount }}</strong> 个，
                      失败 <strong>{{ githubBatchResults.failureCount }}</strong> 个，
                      总计 <strong>{{ githubBatchResults.totalCount }}</strong> 个
                    </p>
                  </div>
                </template>
              </el-alert>
              
              <div v-if="githubBatchResults.results.length > 0" style="max-height: 300px; overflow-y: auto">
                <el-table :data="githubBatchResults.results" size="small" border>
                  <el-table-column prop="url" label="URL" min-width="300" show-overflow-tooltip />
                  <el-table-column label="状态" width="80">
                    <template #default="scope">
                      <el-tag :type="scope.row.success ? 'success' : 'danger'" size="small">
                        {{ scope.row.success ? '成功' : '失败' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="error" label="错误信息" min-width="200" show-overflow-tooltip>
                    <template #default="scope">
                      {{ scope.row.error || '-' }}
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              
              <div v-if="githubBatchResults.successCount > 0" style="margin-top: 15px; text-align: center">
                <el-button
                  type="success"
                  @click="useBatchResultsForPrediction"
                  :disabled="githubBatchResults.successCount === 0"
                >
                  使用成功结果进行批量预测
                </el-button>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload, UploadFilled, Download, ArrowDown as ArrowDownIcon } from '@element-plus/icons-vue'
import { predictionApi, githubApi } from '@/services/api'
import type { Prediction, GitHubFetchResponse, GitHubBatchFetchResponse } from '@/services/api'

const router = useRouter()

// Data
const predictions = ref<Prediction[]>([])
const loading = ref(false)
const predicting = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// Dialogs
const showSingleDialog = ref(false)
const showBatchDialog = ref(false)

// Forms
const singleFormRef = ref()
const singleForm = ref({
  sample_id: '',
  text_description: '',
  cvss_base_score: undefined as number | undefined,
})

// GitHub fetch
const githubTab = ref('single')
const fetchingGithub = ref(false)
const githubForm = ref({
  url: '',
})

// GitHub batch fetch
const fetchingGithubBatch = ref(false)
const githubBatchForm = ref({
  urls: '',
})
const githubBatchResults = ref<GitHubBatchFetchResponse | null>(null)

const singleRules = {
  sample_id: [{ required: true, message: 'Please enter sample ID', trigger: 'blur' }],
  text_description: [
    { required: true, message: 'Please enter text description', trigger: 'blur' },
  ],
}

// Batch prediction
const batchUploadRef = ref()
const batchFileInfo = ref<{
  name: string
  sampleCount: number
  samples: Array<{
    sample_id: string
    text_description: string
    cvss_base_score?: number
  }>
  file?: File
} | null>(null)

// Methods
const loadPredictions = async () => {
  loading.value = true
  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const result = await predictionApi.getAll(pageSize.value, offset)
    predictions.value = result.data
    total.value = result.total
  } catch (error: any) {
    ElMessage.error('Failed to load predictions: ' + (error.message || 'Unknown error'))
  } finally {
    loading.value = false
  }
}

const submitSinglePrediction = async () => {
  if (!singleFormRef.value) return

      await singleFormRef.value.validate(async (valid: boolean) => {
        if (!valid) return

        predicting.value = true
        try {
          await predictionApi.predict({
            sample_id: singleForm.value.sample_id,
            text_description: singleForm.value.text_description,
            cvss_base_score: singleForm.value.cvss_base_score,
          })

      ElMessage.success('Prediction completed successfully')
      showSingleDialog.value = false
      singleForm.value = {
        sample_id: '',
        text_description: '',
        cvss_base_score: undefined,
      }
      loadPredictions()
    } catch (error: any) {
      ElMessage.error('Prediction failed: ' + (error.message || 'Unknown error'))
    } finally {
      predicting.value = false
    }
  })
}

const handleBatchFileChange = (file: any) => {
  const fileName = file.name.toLowerCase()
  const fileExt = fileName.substring(fileName.lastIndexOf('.'))
  
  // Validate file type
  const allowedExtensions = ['.json', '.csv', '.xlsx', '.xls']
  if (!allowedExtensions.includes(fileExt)) {
    ElMessage.error('Unsupported file format. Please upload JSON, CSV, or Excel file.')
    batchFileInfo.value = null
    return
  }

  // For JSON files, we can preview the content
  if (fileExt === '.json') {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        let samples: any[] = []
        
        // Handle both { "samples": [...] } and [...] formats
        if (Array.isArray(json)) {
          samples = json
        } else if (json.samples && Array.isArray(json.samples)) {
          samples = json.samples
        } else {
          ElMessage.warning('File uploaded. Will be processed on server.')
          batchFileInfo.value = {
            name: file.name,
            sampleCount: 0,
            samples: [],
            file: file.raw,
          }
          return
        }

        // Validate samples
        const validSamples = samples.filter((sample: any) => {
          const sampleId = sample.sample_id || sample.sampleId || sample.id
          const textDescription = sample.text_description || sample.textDescription || sample.description
          return sampleId && textDescription
        })

        if (validSamples.length === 0) {
          ElMessage.warning('File uploaded. Will be validated on server.')
          batchFileInfo.value = {
            name: file.name,
            sampleCount: 0,
            samples: [],
            file: file.raw,
          }
        } else {
          ElMessage.success(`File ready: ${file.name} (${validSamples.length} samples detected)`)
          batchFileInfo.value = {
            name: file.name,
            sampleCount: validSamples.length,
            samples: validSamples,
            file: file.raw,
          }
        }
      } catch (error) {
        ElMessage.warning('File uploaded. Will be processed on server.')
        batchFileInfo.value = {
          name: file.name,
          sampleCount: 0,
          samples: [],
          file: file.raw,
        }
      }
    }
    reader.onerror = () => {
      ElMessage.warning('File uploaded. Will be processed on server.')
      batchFileInfo.value = {
        name: file.name,
        sampleCount: 0,
        samples: [],
        file: file.raw,
      }
    }
    reader.readAsText(file.raw)
  } else {
    // For CSV and Excel, we'll let the server handle parsing
    ElMessage.success(`File uploaded: ${file.name}`)
    batchFileInfo.value = {
      name: file.name,
      sampleCount: 0, // Will be determined by server
      samples: [],
      file: file.raw,
    }
  }
}

const handleBatchFileRemove = () => {
  batchFileInfo.value = null
}

const closeBatchDialog = () => {
  showBatchDialog.value = false
  batchFileInfo.value = null
  if (batchUploadRef.value) {
    batchUploadRef.value.clearFiles()
  }
}

const submitBatchPrediction = async () => {
  if (!batchFileInfo || !batchFileInfo.value.file) {
    ElMessage.warning('Please upload a file')
    return
  }

  predicting.value = true
  try {
    // Use file upload API for better format support
    const result = await predictionApi.batchPredictFromFile(batchFileInfo.value.file)

    const count = result.predictions?.length || result.count || 0
    ElMessage.success(`Batch prediction completed: ${count} predictions saved`)
    
    closeBatchDialog()
    loadPredictions()
  } catch (error: any) {
    ElMessage.error('Batch prediction failed: ' + (error.message || 'Unknown error'))
  } finally {
    predicting.value = false
  }
}

const viewReport = (id: string) => {
  router.push(`/predictions/${id}`)
}

const handleExport = async (format: 'csv' | 'excel' | 'json') => {
  if (predictions.value.length === 0) {
    ElMessage.warning('No predictions to export')
    return
  }

  try {
    ElMessage.info('Exporting predictions...')
    
    // Export all predictions (or current page based on requirements)
    const blob = await predictionApi.export(format, undefined, undefined)
    
    // Create download link
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    // Set filename based on format
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const extension = format === 'excel' ? 'xlsx' : format
    link.download = `predictions_${timestamp}.${extension}`
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success(`Predictions exported successfully as ${format.toUpperCase()}`)
  } catch (error: any) {
    console.error('Export error:', error)
    ElMessage.error(`Failed to export predictions: ${error.message || 'Unknown error'}`)
  }
}

const formatPercent = (value: number) => {
  return (value * 100).toFixed(2) + '%'
}

const formatRiskScore = (value: number) => {
  return value.toFixed(2)
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString()
}

const getRiskColor = (value: number) => {
  if (value >= 0.8) return '#f56c6c' // Critical - Red
  if (value >= 0.6) return '#e6a23c' // High - Orange
  if (value >= 0.4) return '#f0c020' // Medium - Yellow
  return '#67c23a' // Low - Green
}

const getRiskTagType = (level: string) => {
  switch (level) {
    case 'Critical':
      return 'danger'
    case 'High':
      return 'warning'
    case 'Medium':
      return 'info'
    case 'Low':
      return 'success'
    case 'N/A':
      return '' // 灰色默认样式
    case 'Uncertain':
      return 'warning' // 橙色警告样式
    default:
      return 'info'
  }
}

const fetchGitHubText = async () => {
  if (!githubForm.value.url.trim()) {
    ElMessage.warning('请输入 GitHub URL')
    return
  }

  fetchingGithub.value = true
  try {
    const result: GitHubFetchResponse = await githubApi.fetchText(githubForm.value.url)

    // Fill the single prediction form
    singleForm.value.sample_id = result.sample_id
    singleForm.value.text_description = result.text_description
    singleForm.value.cvss_base_score = undefined // Keep CVSS empty as required

    // Show success message
    const truncatedMsg = result.meta.truncated ? '（已截断）' : ''
    ElMessage.success(
      `抓取成功：${result.sourceType}，sample_id: ${result.sample_id}${truncatedMsg}`
    )

    // Open the single prediction dialog
    showSingleDialog.value = true

    // Clear GitHub form
    githubForm.value.url = ''
  } catch (error: any) {
    ElMessage.error('抓取失败：' + (error.response?.data?.error || error.message || 'Unknown error'))
  } finally {
    fetchingGithub.value = false
  }
}

const fetchGitHubTextBatch = async () => {
  if (!githubBatchForm.value.urls.trim()) {
    ElMessage.warning('请输入至少一个 GitHub URL')
    return
  }

  // Parse URLs from textarea (split by newlines, filter empty lines)
  const urls = githubBatchForm.value.urls
    .split('\n')
    .map((url) => url.trim())
    .filter((url) => url.length > 0)

  if (urls.length === 0) {
    ElMessage.warning('请输入至少一个有效的 GitHub URL')
    return
  }

  fetchingGithubBatch.value = true
  githubBatchResults.value = null
  try {
    const result = await githubApi.batchFetchText(urls)
    githubBatchResults.value = result

    // Show summary message
    if (result.failureCount === 0) {
      ElMessage.success(`批量抓取成功：${result.successCount} 个 URL 全部抓取成功`)
    } else {
      ElMessage.warning(
        `批量抓取完成：成功 ${result.successCount} 个，失败 ${result.failureCount} 个`
      )
    }
  } catch (error: any) {
    ElMessage.error('批量抓取失败：' + (error.response?.data?.error || error.message || 'Unknown error'))
  } finally {
    fetchingGithubBatch.value = false
  }
}

const useBatchResultsForPrediction = async () => {
  if (!githubBatchResults.value || githubBatchResults.value.successCount === 0) {
    ElMessage.warning('没有可用的抓取结果')
    return
  }

  // Extract successful results
  const successfulSamples = githubBatchResults.value.results
    .filter((r) => r.success && r.data)
    .map((r) => ({
      sample_id: r.data!.sample_id,
      text_description: r.data!.text_description,
      cvss_base_score: undefined, // Keep CVSS empty as required
    }))

  if (successfulSamples.length === 0) {
    ElMessage.warning('没有可用的抓取结果')
    return
  }

  // Perform batch prediction
  predicting.value = true
  try {
    const result = await predictionApi.batchPredict({
      samples: successfulSamples,
    })

    const count = result.predictions?.length || result.count || 0
    ElMessage.success(`批量预测完成：${count} 个预测已保存`)

    // Clear batch results and form
    githubBatchResults.value = null
    githubBatchForm.value.urls = ''

    // Reload predictions
    loadPredictions()
  } catch (error: any) {
    ElMessage.error('批量预测失败：' + (error.message || 'Unknown error'))
  } finally {
    predicting.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadPredictions()
})
</script>

<style scoped>
.predictions-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metrics {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.metrics span {
  font-size: 12px;
}
</style>
