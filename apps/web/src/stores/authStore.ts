import { create } from 'zustand'
import type { User, UserProfile } from '@uniconnect/shared/types'
import { connectSocket, disconnectSocket, joinUniversityRoom, leaveUniversityRoom } from '@/lib/socket'
import { api } from '@/lib/axios'
import { queryClient } from '@/lib/queryClient'

interface AuthState {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  setLoading: (v: boolean) => void
  updateProfile: (partial: Partial<UserProfile>) => void
  markVerified: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  setAuth: (user, token) => {
    localStorage.setItem('uc:has_session', '1')
    set({ user, accessToken: token, isLoading: false })
    connectSocket()
    joinUniversityRoom(user.universityId)
  },

  clearAuth: () => {
    localStorage.removeItem('uc:has_session')
    const { user, accessToken } = get()
    if (accessToken) {
      api.post('/auth/logout').catch(() => {})
    }
    if (user) leaveUniversityRoom(user.universityId)
    set({ user: null, accessToken: null, isLoading: false })
    disconnectSocket()
    queryClient.clear()
  },

  setLoading: (v) => set({ isLoading: v }),

  updateProfile: (partial) =>
    set((state) => {
      if (!state.user) return state
      return {
        user: {
          ...state.user,
          profile: { ...state.user.profile, ...partial },
        },
      }
    }),

  markVerified: () =>
    set((state) => {
      if (!state.user) return state
      return { user: { ...state.user, isVerified: true } }
    }),
}))
