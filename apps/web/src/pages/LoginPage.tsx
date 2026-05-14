import { FormEvent, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { PrimaryBtn } from '@/components/Button'
import { BrandLogo } from '@/components/BrandLogo'
import { PATHS } from '@/router/paths'
import type { User } from '@uniconnect/shared/types'

interface LoginResponse {
  data: {
    accessToken: string
    user: User
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
      setAuth(data.data.user, data.data.accessToken)
      navigate(PATHS.FEED, { replace: true })
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setError('Invalid email or password')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleRegisterNav(e: FormEvent) {
    e.preventDefault()
    if (inviteToken.trim()) {
      navigate(PATHS.REGISTER.replace(':token', inviteToken.trim()))
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--surface-page)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <BrandLogo height={40} />
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-xl)',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
            }}>
              Sign in
            </h1>
            <p style={{
              margin: '6px 0 0',
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              Welcome back to UniConnecT
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Email
              </span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@uiu.ac.bd"
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Password
                </span>
                <Link
                  to={PATHS.FORGOT_PASSWORD}
                  style={{ fontSize: 12, color: 'var(--uc-indigo-l)', textDecoration: 'none' }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </label>

            {error && (
              <p style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--uc-orange-l)',
                background: 'var(--uc-orange-bg)',
                border: '0.5px solid var(--uc-orange-bdr)',
                borderRadius: 'var(--r-sm)',
                padding: '8px 12px',
              }}>
                {error}
              </p>
            )}

            <PrimaryBtn
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </PrimaryBtn>
          </form>
        </div>

        {/* Invite / register section */}
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-xl)',
          padding: '20px 28px',
        }}>
          <p style={{
            margin: '0 0 12px',
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}>
            Have an invitation? Enter your invite code to register.
          </p>
          <form onSubmit={handleRegisterNav} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              placeholder="Invite code"
              style={{ ...inputStyle, flex: 1, fontSize: 13 }}
            />
            <PrimaryBtn
              type="submit"
              disabled={!inviteToken.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              Register
            </PrimaryBtn>
          </form>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Or{' '}
            <Link
              to={PATHS.REGISTER_ENTRY}
              style={{ color: 'var(--uc-indigo-l)', textDecoration: 'none' }}
            >
              go to register page
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  padding: '10px 14px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}
