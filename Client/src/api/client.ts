import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/client/v1`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach access token from SecureStore
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const accessToken = await SecureStore.getItemAsync('accessToken')
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

// Flag to prevent multiple concurrent refresh attempts
let isRefreshing = false
let failedRequestsQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

// Response interceptor: auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          failedRequestsQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken')
        if (!refreshToken) throw new Error('No refresh token')

        const { data } = await axios.post(
          `${BASE_URL}/api/client/v1/auth/refresh`,
          { refreshToken }
        )

        const newAccessToken: string = data.data.accessToken
        const newRefreshToken: string = data.data.refreshToken

        await SecureStore.setItemAsync('accessToken', newAccessToken)
        await SecureStore.setItemAsync('refreshToken', newRefreshToken)

        // Resolve queued requests
        failedRequestsQueue.forEach(({ resolve }) => resolve(newAccessToken))
        failedRequestsQueue = []

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        // Refresh failed — clear tokens (force re-login)
        failedRequestsQueue.forEach(({ reject }) => reject(refreshError))
        failedRequestsQueue = []

        await SecureStore.deleteItemAsync('accessToken')
        await SecureStore.deleteItemAsync('refreshToken')
        await SecureStore.deleteItemAsync('clientId')

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
