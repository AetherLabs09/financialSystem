import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login as loginApi, verifyToken } from '../api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || 'null'))

  const login = async (username, password) => {
    const res = await loginApi(username, password)
    token.value = res.token
    userInfo.value = res.user
    localStorage.setItem('token', res.token)
    localStorage.setItem('userInfo', JSON.stringify(res.user))
    return res
  }

  const logout = () => {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  const checkAuth = async () => {
    if (!token.value) return false
    try {
      const res = await verifyToken()
      return res.valid
    } catch {
      logout()
      return false
    }
  }

  const hasPermission = (permission) => {
    if (!userInfo.value) return false
    if (userInfo.value.role === 'admin') return true
    return userInfo.value.permissions?.includes('all') || userInfo.value.permissions?.includes(permission)
  }

  return { token, userInfo, login, logout, checkAuth, hasPermission }
})
