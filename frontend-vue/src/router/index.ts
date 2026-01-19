import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from '../stores/auth'
import Login from '../views/Login.vue'
import Datasets from '../views/Datasets.vue'
import Models from '../views/Models.vue'
import Predictions from '../views/Predictions.vue'
import Report from '../views/Report.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: Login,
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      redirect: (to) => {
        const { isAuthenticated, isAdmin } = useAuth()
        if (!isAuthenticated.value) {
          return '/login'
        }
        return isAdmin.value ? '/datasets' : '/models'
      },
    },
    {
      path: '/datasets',
      name: 'Datasets',
      component: Datasets,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/models',
      name: 'Models',
      component: Models,
      meta: { requiresAuth: true },
    },
    {
      path: '/predictions',
      name: 'Predictions',
      component: Predictions,
      meta: { requiresAuth: true },
    },
    {
      path: '/predictions/:id',
      name: 'Report',
      component: Report,
      meta: { requiresAuth: true },
    },
  ],
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, isAdmin, checkAuth } = useAuth()

  // Check authentication status
  if (!isAuthenticated.value && tokenExists()) {
    const isValid = await checkAuth()
    if (!isValid) {
      next('/login')
      return
    }
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next('/login')
    return
  }

  // Check if route requires admin
  if (to.meta.requiresAdmin && !isAdmin.value) {
    ElMessage.warning('Admin access required')
    next('/models')
    return
  }

  // Redirect to login if already authenticated and trying to access login page
  if (to.path === '/login' && isAuthenticated.value) {
    next(isAdmin.value ? '/datasets' : '/models')
    return
  }

  next()
})

function tokenExists(): boolean {
  return !!localStorage.getItem('token')
}

export default router








