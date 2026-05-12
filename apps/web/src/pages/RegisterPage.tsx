import { FormEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import type { User } from '@uniconnect/shared/types'
import logoSrc from '@/assets/logo.svg'

interface RegisterResponse {
  data: {
    user: User
    accessToken: string
  }
}

function validate(fullName: string, password: string, confirmPassword: string) {
  const errs: Record<string, string> = {}
  if (!fullName.trim()) errs.fullName = 'Full name is required'
  if (password.length < 8) errs.password = 'Password must be at least 8 characters'
  if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
  return errs
}

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [fullName, setFullName]               = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors]         = useState<Record<string, string>>({})
  const [serverError, setServerError]         = useState<string | null>(null)
  const [loading, setLoading]                 = useState(false)

  if (!token || token === 'invite') {
    navigate(PATHS.LOGIN + '?error=missing_token', { replace: true })
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setServerError(null)

    const errs = validate(fullName, password, confirmPassword)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    try {
      const { data } = await api.post<RegisterResponse>('/auth/register', {
        token,
        password,
        fullName: fullName.trim(),
      })
      const registeredUser = data.data.user
      setAuth(registeredUser, data.data.accessToken)
      navigate(registeredUser.isVerified ? PATHS.FEED : PATHS.OTP, { replace: true })
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        const code: string = err.response?.data?.code ?? ''
        if (status === 409 || code === 'CONFLICT') {
          setServerError('An account already exists for this invitation.')
        } else if (status === 404 || code === 'NOT_FOUND') {
          setServerError('Invitation token is invalid or expired.')
        } else if (status === 422) {
          setServerError('Please check your details and try again.')
        } else {
          setServerError('Something went wrong. Please try again.')
        }
      } else {
        setServerError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
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
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src={logoSrc} alt="UniConnecT" style={{ height: 40 }} />
        </div>

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
              Create your account
            </h1>
            <p style={{
              margin: '6px 0 0',
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              You're registering with invitation code{' '}
              <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {token}
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Full name" error={fieldErrors.fullName}>
              <input
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Joydip Datta"
                style={inputStyle}
              />
            </Field>

            <Field label="Password" error={fieldErrors.password}>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                style={inputStyle}
              />
            </Field>

            <Field label="Confirm password" error={fieldErrors.confirmPassword}>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </Field>

            {serverError && (
              <p style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--uc-orange-l)',
                background: 'var(--uc-orange-bg)',
                border: '0.5px solid var(--uc-orange-bdr)',
                borderRadius: 'var(--r-sm)',
                padding: '8px 12px',
              }}>
                {serverError}
              </p>
            )}

            <PrimaryBtn
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </PrimaryBtn>
          </form>
        </div>

        <p style={{
          margin: 0,
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          Already have an account?{' '}
          <a
            href={PATHS.LOGIN}
            style={{ color: 'var(--uc-indigo-l)', textDecoration: 'none' }}
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
        {label}
      </span>
      {children}
      {error && (
        <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{error}</span>
      )}
    </label>
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
