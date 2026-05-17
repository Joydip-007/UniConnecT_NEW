import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { isAxiosError } from 'axios'
import { api } from '@/lib/axios'
import { PrimaryBtn } from '@/components/Button'
import { BrandLogo } from '@/components/BrandLogo'
import { PATHS } from '@/router/paths'
import type { User, UserRole } from '@uniconnect/shared/types'

interface RegisterResponse {
  data: {
    message: string
    user: User
    accessToken: string
  }
}

interface InvitePreview {
  role: UserRole
  email: string
}

interface InvitePreviewResponse {
  data: InvitePreview
}

function validate(fullName: string, password: string, confirmPassword: string) {
  const errs: Record<string, string> = {}
  if (!fullName.trim()) errs.fullName = 'Full name is required'
  if (!/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) errs.password = 'Must be 8+ chars with a number, uppercase, and symbol.'
  if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
  return errs
}

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [fullName, setFullName]               = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteToken, setInviteToken]         = useState('')
  const [fieldErrors, setFieldErrors]         = useState<Record<string, string>>({})
  const [serverError, setServerError]         = useState<string | null>(null)
  const [loading, setLoading]                 = useState(false)

  const [inviteData, setInviteData]         = useState<InvitePreview | null>(null)
  const [inviteLoading, setInviteLoading]   = useState(false)
  const [inviteError, setInviteError]       = useState<string | null>(null)
  const [department, setDepartment]         = useState('')

  useEffect(() => {
    if (!token || token === 'invite') return
    setInviteLoading(true)
    api.get<InvitePreviewResponse>(`/auth/invitation/${token}`)
      .then(({ data }) => setInviteData(data.data))
      .catch(() => setInviteError('Invitation is invalid or has already been used.'))
      .finally(() => setInviteLoading(false))
  }, [token])

  if (!token || token === 'invite') {
    return (
      <RegisterShell>
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
              Enter your invitation code to continue registration.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const nextToken = inviteToken.trim()
              if (nextToken) navigate(PATHS.REGISTER.replace(':token', nextToken))
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Field label="Invite code">
              <input
                type="text"
                autoComplete="off"
                required
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="dev-invite"
                style={inputStyle}
              />
            </Field>

            <PrimaryBtn
              type="submit"
              disabled={!inviteToken.trim()}
              style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
            >
              Continue
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
      </RegisterShell>
    )
  }

  if (inviteLoading) {
    return (
      <RegisterShell>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
          Checking invitation…
        </p>
      </RegisterShell>
    )
  }

  if (inviteError) {
    return (
      <RegisterShell>
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-xl)',
          padding: '32px 28px',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--uc-orange-l)' }}>
            {inviteError}
          </p>
        </div>
      </RegisterShell>
    )
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
        ...(inviteData && inviteData.role !== 'admin' && department.trim()
          ? { department: department.trim() }
          : {}),
      })
      navigate(`${PATHS.VERIFY_OTP}?purpose=verify`, {
        state: { email: data.data.user.email },
        replace: true,
      })
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
    <RegisterShell>
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

          {inviteData && inviteData.role !== 'admin' && (
            <Field label="Department (optional)">
              <input
                type="text"
                autoComplete="off"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. CSE"
                maxLength={100}
                style={inputStyle}
              />
            </Field>
          )}

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
    </RegisterShell>
  )
}

function RegisterShell({ children }: { children: React.ReactNode }) {
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
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.background = 'var(--surface-raised)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)'
            e.currentTarget.style.background = 'var(--surface-card)'
          }}
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
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <BrandLogo height={40} />
        </div>

        {children}
      </div>
    </main>
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
