<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <h2>VulnRisk Platform</h2>
        <p class="subtitle">Vulnerability Risk Assessment System</p>
      </template>

      <el-tabs v-model="activeTab" class="auth-tabs">
        <el-tab-pane label="Login" name="login">
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            label-width="100px"
          >
            <el-form-item label="Username" prop="username">
              <el-input
                v-model="loginForm.username"
                placeholder="Enter your username"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-form-item label="Password" prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="Enter your password"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :loading="loading"
                @click="handleLogin"
                style="width: 100%"
              >
                Login
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="Register" name="register">
          <el-form
            ref="registerFormRef"
            :model="registerForm"
            :rules="registerRules"
            label-width="100px"
          >
            <el-form-item label="Username" prop="username">
              <el-input
                v-model="registerForm.username"
                placeholder="Choose a username"
              />
            </el-form-item>
            <el-form-item label="Email" prop="email">
              <el-input
                v-model="registerForm.email"
                type="email"
                placeholder="Enter your email (optional)"
              />
            </el-form-item>
            <el-form-item label="Password" prop="password">
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="At least 6 characters"
                show-password
              />
            </el-form-item>
            <el-form-item label="Confirm" prop="confirmPassword">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                placeholder="Confirm your password"
                show-password
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :loading="loading"
                @click="handleRegister"
                style="width: 100%"
              >
                Register
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuth } from '../stores/auth'

const router = useRouter()
const { login, register, loading } = useAuth()

const activeTab = ref('login')
const loginFormRef = ref<FormInstance>()
const registerFormRef = ref<FormInstance>()

const loginForm = reactive({
  username: '',
  password: '',
})

const registerForm = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const validateConfirmPassword = (rule: any, value: any, callback: any) => {
  if (value !== registerForm.password) {
    callback(new Error('Passwords do not match'))
  } else {
    callback()
  }
}

const loginRules: FormRules = {
  username: [
    { required: true, message: 'Please enter username', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Please enter password', trigger: 'blur' },
  ],
}

const registerRules: FormRules = {
  username: [
    { required: true, message: 'Please enter username', trigger: 'blur' },
    { min: 3, message: 'Username must be at least 3 characters', trigger: 'blur' },
  ],
  email: [
    { type: 'email', message: 'Please enter a valid email', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Please enter password', trigger: 'blur' },
    { min: 6, message: 'Password must be at least 6 characters', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: 'Please confirm password', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}

const handleLogin = async () => {
  if (!loginFormRef.value) return

  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await login(loginForm.username, loginForm.password)
        ElMessage.success('Login successful')
        router.push('/')
      } catch (error: any) {
        ElMessage.error(error.response?.data?.error || 'Login failed')
      }
    }
  })
}

const handleRegister = async () => {
  if (!registerFormRef.value) return

  await registerFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await register(
          registerForm.username,
          registerForm.password,
          registerForm.email || undefined
        )
        ElMessage.success('Registration successful')
        router.push('/')
      } catch (error: any) {
        ElMessage.error(error.response?.data?.error || 'Registration failed')
      }
    }
  })
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 450px;
}

.login-card h2 {
  text-align: center;
  margin: 0 0 10px 0;
  color: #303133;
}

.subtitle {
  text-align: center;
  color: #909399;
  margin: 0;
  font-size: 14px;
}

.auth-tabs {
  margin-top: 20px;
}
</style>








