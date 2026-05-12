import { create } from 'zustand'
import type { User, UserProfile } from '@uniconnect/shared/types'
import { connectSocket, disconnectSocket } from '@/lib/socket'

interface AuthState {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  updateProfile: (partial: Partial<UserProfile>) => void
  markVerified: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: false,

  setAuth: (user, token) => {
    set({ user, accessToken: token, isLoading: false })
    connectSocket()
  },

  clearAuth: () => {
    set({ user: null, accessToken: null, isLoading: false })
    disconnectSocket()
  },

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
