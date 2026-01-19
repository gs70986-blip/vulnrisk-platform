import { ref, computed } from 'vue'
import { authApi, type User } from '../services/api'

const user = ref<User | null>(null)
const token = ref<string | null>(localStorage.getItem('token'))
const loading = ref(false)

// Load user from localStorage on init
const savedUser = localStorage.getItem('user')
if (savedUser) {
  try {
    user.value = JSON.parse(savedUser)
  } catch (e) {
    console.error('Failed to parse saved user:', e)
  }
}

export const useAuth = () => {
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const currentUser = computed(() => user.value)

  const login = async (username: string, password: string) => {
    loading.value = true
    try {
      const response = await authApi.login({ username, password })
      token.value = response.token
      user.value = response.user
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      return response
    } finally {
      loading.value = false
    }
  }

  const register = async (username: string, password: string, email?: string) => {
    loading.value = true
    try {
      const response = await authApi.register({ username, password, email })
      token.value = response.token
      user.value = response.user
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      return response
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const checkAuth = async () => {
    if (!token.value) {
      return false
    }

    try {
      const response = await authApi.getCurrentUser()
      user.value = response.user
      localStorage.setItem('user', JSON.stringify(response.user))
      return true
    } catch (error) {
      // Token invalid, clear storage
      logout()
      return false
    }
  }

  return {
    user,
    token,
    loading,
    isAuthenticated,
    isAdmin,
    currentUser,
    login,
    register,
    logout,
    checkAuth,
  }
}








