<template>
  <el-container class="app-container" v-if="isAuthenticated">
    <el-header class="app-header">
      <div class="header-content">
        <h1>VulnRisk - Vulnerability Risk Assessment Platform</h1>
        <div class="user-info">
          <el-dropdown @command="handleCommand">
            <span class="user-dropdown">
              <el-icon><User /></el-icon>
              <span>{{ currentUser?.username }}</span>
              <el-tag :type="isAdmin ? 'danger' : 'info'" size="small" style="margin-left: 8px">
                {{ isAdmin ? 'Admin' : 'User' }}
              </el-tag>
              <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  <span style="color: #909399;">{{ currentUser?.email || 'No email' }}</span>
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">Logout</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-header>
    <el-container>
      <el-aside width="200px" class="app-aside">
        <el-menu
          :default-active="activeMenu"
          router
          class="sidebar-menu"
        >
          <el-menu-item v-if="isAdmin" index="/datasets">
            <el-icon><Document /></el-icon>
            <span>Datasets</span>
          </el-menu-item>
          <el-menu-item index="/models">
            <el-icon><Cpu /></el-icon>
            <span>Models</span>
          </el-menu-item>
          <el-menu-item index="/predictions">
            <el-icon><DataAnalysis /></el-icon>
            <span>Predictions</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
  <router-view v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Cpu, DataAnalysis, User, ArrowDown } from '@element-plus/icons-vue'
import { useAuth } from './stores/auth'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, isAdmin, currentUser, logout } = useAuth()

const activeMenu = computed(() => route.path)

const handleCommand = async (command: string) => {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('Are you sure you want to logout?', 'Confirm Logout', {
        confirmButtonText: 'Logout',
        cancelButtonText: 'Cancel',
        type: 'warning',
      })
      logout()
      ElMessage.success('Logged out successfully')
      router.push('/login')
    } catch {
      // User cancelled
    }
  }
}
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.app-header {
  background-color: #409eff;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.app-header h1 {
  margin: 0;
  font-size: 20px;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-dropdown {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.user-dropdown:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.user-dropdown span {
  margin-left: 8px;
  margin-right: 8px;
}

.app-aside {
  background-color: #f5f5f5;
}

.sidebar-menu {
  border-right: none;
}

.app-main {
  padding: 20px;
  background-color: #fafafa;
}
</style>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}
</style>








