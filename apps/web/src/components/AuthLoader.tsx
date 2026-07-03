import { useEffect, useRef, type ReactNode } from 'react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import type { User } from '@uniconnect/shared/types'

interface RefreshResponse {
  data: { accessToken: string }
}

interface MeResponse {
  data: User
}

// id/universityId must match devMocks.ts's DEV_PROFILE and screenshot.cjs's DEV_USER_ID —
// ProfilePage computes `isOwnProfile` by comparing this id to the fetched profile's id.
const DEV_MOCK_USER: User = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'devuser',
  email: 'dev@uiu.ac.bd',
  role: 'student',
  universityId: '22222222-2222-4222-8222-222222222222',
  isVerified: true,
  themePreference: 'dark',
  profile: {
    fullName: 'Dev User',
    bio: 'Development bypass account for design verification.',
    avatarUrl: null,
    coverUrl: null,
    headline: 'Software Engineering Student',
    department: 'CSE',
    batchYear: '2024',
    linkedinUrl: null,
    phone: null,
    skills: ['React', 'TypeScript', 'Node.js'],
    isOpenToWork: false,
    isOpenToMentorship: false,
    mentorshipPoints: 0,
    maxMentees: 3,
    location: 'Dhaka, Bangladesh',
    websiteUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    isOpenToMsg: true,
  },
}

export function AuthLoader({ children }: { children: ReactNode }) {
  const isLoading = useAuthStore((s) => s.isLoading)
  // Prevents React StrictMode's double-invocation from firing two simultaneous
  // POST /auth/refresh requests. useRef persists across the simulated
  // unmount/remount cycle, so the second effect invocation bails immediately.
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    async function rehydrate() {
      const { setAuth, setLoading, clearAuth } = useAuthStore.getState()

      // DEV ONLY: ?dev-auth=1 seeds a mock user and skips the real refresh/login flow.
      // Used for design verification screenshots without a running backend.
      if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev-auth') === '1') {
        setAuth(DEV_MOCK_USER, 'dev-bypass-token')
        return
      }

      // Skip refresh entirely when there's no prior session — avoids a guaranteed
      // 401 on every public page (forgot-password, login, register, etc.).
      if (!localStorage.getItem('uc:has_session')) {
        setLoading(false)
        return
      }

      try {
        const { data: refreshData } = await api.post<RefreshResponse>('/auth/refresh')
        const token = refreshData.data.accessToken
        if (!token) {
          clearAuth()
          return
        }
        const { data: meData } = await api.get<MeResponse>('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setAuth(meData.data, token)
        useThemeStore.getState().hydrateFromProfile(meData.data.themePreference)
      } catch {
        clearAuth()
      }
    }

    rehydrate()
  }, [])

  if (isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-page)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid var(--border-default)',
            borderTopColor: 'var(--uc-indigo)',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return <>{children}</>
}
