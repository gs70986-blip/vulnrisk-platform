import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5 minutes for long operations
})

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear storage and redirect to login
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface Dataset {
  id: string
  name: string
  schema: any
  recordCount: number
  createdAt: string
}

export interface MLModel {
  id: string
  type: string
  metrics: {
    accuracy: number
    precision: number
    recall: number
    f1: number
    roc_auc: number
  }
  artifactPath: string
  metadata?: any
  isActive: boolean
  createdAt: string
}

export interface Prediction {
  explanation?: string | null
  meta?: {
    applicable?: boolean
    reason?: string | null
    max_similarity?: number | null
    nonzero_features?: number | null
    text_len?: number | null
    thresholds?: Record<string, any>
  } | null
  id: string
  modelId: string
  sampleId: string
  textDescription?: string
  pVuln: number
  cvss?: number
  riskScore: number
  riskLevel: string
  createdAt: string
  model?: {
    id: string
    type: string
  }
}

export interface User {
  id: string
  username: string
  email: string | null
  role: 'admin' | 'user'
}

export interface AuthResponse {
  user: User
  token: string
}

// Auth APIs
export const authApi = {
  register: async (params: {
    username: string
    email?: string
    password: string
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', params)
    return response.data
  },

  login: async (params: {
    username: string
    password: string
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', params)
    return response.data
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me')
    return response.data
  },
}

// Dataset APIs
export const datasetApi = {
  upload: async (file: File, name?: string): Promise<Dataset> => {
    const formData = new FormData()
    formData.append('file', file)
    if (name) {
      formData.append('name', name)
    }
    const response = await api.post('/datasets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  getAll: async (): Promise<Dataset[]> => {
    const response = await api.get('/datasets')
    return response.data
  },

  getById: async (id: string): Promise<Dataset> => {
    const response = await api.get(`/datasets/${id}`)
    return response.data
  },

  preprocess: async (id: string) => {
    const response = await api.post(`/datasets/${id}/preprocess`)
    return response.data
  },
}

// Model APIs
export const modelApi = {
  train: async (params: {
    datasetId: string
    modelType: 'RandomForest' | 'XGBoost'
    useSmote?: boolean
    testSize?: number
    randomState?: number
  }): Promise<MLModel> => {
    const response = await api.post('/models/train', params)
    return response.data
  },

  getAll: async (): Promise<MLModel[]> => {
    const response = await api.get('/models')
    return response.data
  },

  getById: async (id: string): Promise<MLModel> => {
    const response = await api.get(`/models/${id}`)
    return response.data
  },

  activate: async (id: string): Promise<MLModel> => {
    const response = await api.post(`/models/${id}/activate`)
    return response.data
  },
}

// Prediction APIs
export const predictionApi = {
  predict: async (params: {
    sample_id: string
    text_description: string
    cvss_base_score?: number
    modelId?: string
  }): Promise<Prediction> => {
    const response = await api.post('/predictions', params)
    return response.data
  },

  batchPredict: async (params: {
    samples: Array<{
      sample_id: string
      text_description: string
      cvss_base_score?: number
    }>
    modelId?: string
  }): Promise<{ predictions: Prediction[]; count: number }> => {
    const response = await api.post('/predictions/batch', params)
    return response.data
  },

  batchPredictFromFile: async (file: File, modelId?: string): Promise<{ predictions: Prediction[]; count: number }> => {
    const formData = new FormData()
    formData.append('file', file)
    if (modelId) {
      formData.append('modelId', modelId)
    }
    const response = await api.post('/predictions/batch/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minutes
    })
    return response.data
  },

  getAll: async (limit?: number, offset?: number): Promise<{ data: Prediction[]; total: number }> => {
    const response = await api.get('/predictions', {
      params: { limit, offset },
    })
    return response.data
  },

  getById: async (id: string): Promise<Prediction> => {
    const response = await api.get(`/predictions/${id}`)
    return response.data
  },

  export: async (format: 'csv' | 'excel' | 'json', limit?: number, offset?: number): Promise<Blob> => {
    const response = await api.get('/predictions/export', {
      params: { format, limit, offset },
      responseType: 'blob',
    })
    return response.data
  },
}

// GitHub APIs
export interface GitHubFetchResponse {
  sourceType: 'issue' | 'pull' | 'commit'
  sample_id: string
  text_description: string
  meta: {
    owner: string
    repo: string
    number: number | null
    sha: string | null
    truncated: boolean
  }
}

export interface GitHubBatchFetchResult {
  url: string
  success: boolean
  data?: GitHubFetchResponse
  error?: string
}

export interface GitHubBatchFetchResponse {
  results: GitHubBatchFetchResult[]
  successCount: number
  failureCount: number
  totalCount: number
}

export const githubApi = {
  fetchText: async (url: string): Promise<GitHubFetchResponse> => {
    const response = await api.post('/github/fetch', { url })
    return response.data
  },

  batchFetchText: async (urls: string[]): Promise<GitHubBatchFetchResponse> => {
    const response = await api.post('/github/fetch-batch', { urls })
    return response.data
  },
}

export default api







