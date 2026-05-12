import { io } from 'socket.io-client'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
const API_BASE = import.meta.env.VITE_API_URL + '/api/v1'

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  auth: (cb: (data: { token: string | null }) => void) => {
    cb({ token: useAuthStore.getState().accessToken })
  },
})

socket.on('connect_error', async (err) => {
  if (err.message !== 'TOKEN_EXPIRED') return

  socket.disconnect()

  try {
    const { data } = await axios.post<{ data: { accessToken: string } }>(
      `${API_BASE}/auth/refresh`,
      undefined,
      { withCredentials: true },
    )
    useAuthStore.setState({ accessToken: data.data.accessToken })
    socket.connect()
  } catch {
    useAuthStore.getState().clearAuth()
  }
})

export function connectSocket() {
  if (!socket.connected) socket.connect()
}

export function disconnectSocket() {
  socket.disconnect()
}
