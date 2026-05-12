import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from '@/router/paths'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

const BASE_URL = import.meta.env.VITE_API_URL + '/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let pendingQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = []

function drainQueue(err: unknown) {
  pendingQueue.forEach((p) => (err ? p.reject(err) : p.resolve()))
  pendingQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    const original = error.config

    if (!original || error.response?.status !== 401) {
      return Promise.reject(error)
    }

    // Already retried once — refresh token is invalid or expired
    if (original._retry) {
      useAuthStore.getState().clearAuth()
      window.location.href = PATHS.LOGIN
      return Promise.reject(error)
    }

    original._retry = true

    // Another refresh is already in progress — queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: () => resolve(api(original)),
          reject,
        })
      })
    }

    isRefreshing = true

    try {
      const { data } = await axios.post<{ data: { accessToken: string } }>(
        `${BASE_URL}/auth/refresh`,
        undefined,
        { withCredentials: true },
      )
      useAuthStore.setState({ accessToken: data.data.accessToken })
      drainQueue(null)
      return api(original)
    } catch (refreshError) {
      drainQueue(refreshError)
      useAuthStore.getState().clearAuth()
      window.location.href = PATHS.LOGIN
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
