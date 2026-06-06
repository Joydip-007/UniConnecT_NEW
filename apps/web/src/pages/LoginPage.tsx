import { FormEvent, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { PrimaryBtn } from '@/components/Button'
import { BrandLogo } from '@/components/BrandLogo'
import { PasswordInput } from '@/components/PasswordInput'
import { PATHS } from '@/router/paths'
import { MinimalPageFooter } from '@/components/MinimalPageFooter'
import type { User } from '@uniconnect/shared/types'

interface LoginResponse {
  data: {
    accessToken: string
    user: User
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const redirectTo = (location.state as { redirect?: string } | null)?.redirect ?? PATHS.FEED

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
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        const code = (err.response?.data as { code?: string } | undefined)?.code
        if (status === 401) {
          setError('Invalid email or password')
        } else if (status === 403 && code === 'ACCOUNT_NOT_VERIFIED') {
          setError('Your account is not verified. Check your email for a verification code.')
        } else if (!err.response) {
          setError('Cannot reach the server. Make sure the API is running.')
        } else {
          setError(`Something went wrong (${status ?? 'unknown'}). Please try again.`)
        }
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
    <main style={{
      minHeight: '100dvh',
      background: 'var(--surface-page)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
    }}>
      {/* Back Button */}
      <div style={{ position: 'absolute', top: 24, left: 24 }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            padding: '8px 12px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            transition: 'background 150ms, color 150ms',
          }}
          className="back-nav-hover"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>
      </div>

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
              <PasswordInput
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </label>

            {error && (
              <p role="alert" style={{
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
      <MinimalPageFooter />
    </main>
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
  transition: 'border-color 150ms',
}
