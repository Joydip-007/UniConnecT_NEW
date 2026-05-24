import { io } from 'socket.io-client'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { useSocketStore } from '@/stores/socketStore'

// Fall back to VITE_API_URL if VITE_SOCKET_URL isn't set — both live on the same server
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL
const API_BASE = import.meta.env.VITE_API_URL + '/api/v1'

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,       // free-tier server can take 30-90 s to wake up
  reconnectionDelay: 2000,              // start at 2 s between attempts
  reconnectionDelayMax: 15000,          // cap at 15 s per attempt
  timeout: 20000,                       // allow 20 s for the handshake during wake-up
  transports: ['websocket', 'polling'], // polling fallback during WebSocket upgrade failures
  auth: (cb: (data: { token: string | null }) => void) => {
    cb({ token: useAuthStore.getState().accessToken })
  },
})

socket.on('connect', () => useSocketStore.getState().setConnected(true))
socket.on('disconnect', () => useSocketStore.getState().setConnected(false))

socket.on('connect_error', async (err) => {
  if (err.message === 'TOKEN_EXPIRED') {
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
    return
  }

  if (err.message === 'Unauthorized') {
    // Token is invalid (not just expired) — log out
    socket.disconnect()
    useAuthStore.getState().clearAuth()
    return
  }

  // Network / server-unreachable errors: let socket.io auto-reconnect
})

export function connectSocket() {
  if (!socket.connected) socket.connect()
}

export function disconnectSocket() {
  socket.disconnect()
}

export function joinUniversityRoom(universityId: string) {
  socket.emit('join:university', { universityId })
}

export function leaveUniversityRoom(universityId: string) {
  socket.emit('leave:university', { universityId })
}
