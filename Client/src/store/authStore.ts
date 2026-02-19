import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { apiClient } from '../api/client'
import { registerForPushNotificationsAsync } from '../utils/pushNotifications'

interface AuthState {
  accessToken: string | null
  isAuthenticated: boolean
  clientId: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  isAuthenticated: false,
  clientId: null,
  isLoading: true,

  checkAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken')
      const clientId = await SecureStore.getItemAsync('clientId')
      set({
        accessToken: token,
        isAuthenticated: !!token,
        clientId,
        isLoading: false,
      })
    } catch {
      set({ isAuthenticated: false, isLoading: false })
    }
  },

  login: async (email: string, password: string) => {
    const { data } = await apiClient.post<{
      data: { accessToken: string; refreshToken: string; clientId: string }
      error: null
    }>('/auth/login', { email, password })

    const { accessToken, refreshToken, clientId } = data.data

    await SecureStore.setItemAsync('accessToken', accessToken)
    await SecureStore.setItemAsync('refreshToken', refreshToken)
    await SecureStore.setItemAsync('clientId', clientId)

    set({ accessToken, isAuthenticated: true, clientId })

    registerForPushNotificationsAsync().catch(() => {})
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // Ignore logout API errors — clear local state regardless
    }

    await SecureStore.deleteItemAsync('accessToken')
    await SecureStore.deleteItemAsync('refreshToken')
    await SecureStore.deleteItemAsync('clientId')

    set({ accessToken: null, isAuthenticated: false, clientId: null })
  },
}))
