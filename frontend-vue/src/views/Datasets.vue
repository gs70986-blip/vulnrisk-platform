<template>
  <div class="datasets-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>Datasets</span>
          <el-button type="primary" @click="showUploadDialog = true">
            <el-icon><Upload /></el-icon>
            Upload Dataset
          </el-button>
        </div>
      </template>

      <el-table :data="datasets" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="Name" width="200" />
        <el-table-column label="Fields" width="200">
          <template #default="scope">
            {{ scope.row.schema?.fields?.length || 0 }} fields
          </template>
        </el-table-column>
        <el-table-column prop="recordCount" label="Records" width="120" />
        <el-table-column prop="createdAt" label="Created At" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="200">
          <template #default="scope">
            <el-button size="small" @click="preprocessDataset(scope.row.id)">
              Preprocess
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Upload Dialog -->
    <el-dialog v-model="showUploadDialog" title="Upload Dataset" width="500px">
      <el-form :model="uploadForm" label-width="120px">
        <el-form-item label="Dataset Name">
          <el-input v-model="uploadForm.name" placeholder="Optional" />
        </el-form-item>
        <el-form-item label="File">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            accept=".csv,.json"
          >
            <el-button type="primary">Select File</el-button>
            <template #tip>
              <div class="el-upload__tip">Only CSV and JSON files are allowed</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUploadDialog = false">Cancel</el-button>
        <el-button type="primary" @click="handleUpload" :loading="uploading">
          Upload
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { datasetApi, type Dataset } from '../services/api'

const datasets = ref<Dataset[]>([])
const loading = ref(false)
const showUploadDialog = ref(false)
const uploading = ref(false)
const uploadRef = ref()
const uploadForm = ref({
  name: '',
  file: null as File | null,
})

const loadDatasets = async () => {
  loading.value = true
  try {
    datasets.value = await datasetApi.getAll()
  } catch (error: any) {
    ElMessage.error(`Failed to load datasets: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const handleFileChange = (file: any) => {
  uploadForm.value.file = file.raw
  if (!uploadForm.value.name) {
    uploadForm.value.name = file.name.replace(/\.(csv|json)$/i, '')
  }
}

const handleUpload = async () => {
  if (!uploadForm.value.file) {
    ElMessage.warning('Please select a file')
    return
  }

  uploading.value = true
  try {
    await datasetApi.upload(
      uploadForm.value.file,
      uploadForm.value.name || undefined
    )
    ElMessage.success('Dataset uploaded successfully')
    showUploadDialog.value = false
    uploadForm.value = { name: '', file: null }
    uploadRef.value?.clearFiles()
    await loadDatasets()
  } catch (error: any) {
    ElMessage.error(`Upload failed: ${error.message}`)
  } finally {
    uploading.value = false
  }
}

const preprocessDataset = async (id: string) => {
  try {
    await datasetApi.preprocess(id)
    ElMessage.success('Dataset preprocessed successfully')
  } catch (error: any) {
    ElMessage.error(`Preprocessing failed: ${error.message}`)
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

onMounted(() => {
  loadDatasets()
})
</script>

<style scoped>
.datasets-page {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

















