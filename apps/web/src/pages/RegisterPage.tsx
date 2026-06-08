// apps/web/src/pages/RegisterPage.tsx
import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { isAxiosError } from 'axios'
import { api } from '@/lib/axios'
import { PrimaryBtn } from '@/components/Button'
import { BrandLogo } from '@/components/BrandLogo'
import { PasswordInput } from '@/components/PasswordInput'
import { PATHS } from '@/router/paths'
import { LandingFooter } from '@/features/landing/components/LandingFooter'
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
  universityName?: string
}

interface InvitePreviewResponse {
  data: InvitePreview
}

const SEMESTERS = ['Fall', 'Spring', 'Summer'] as const
const BATCH_YEARS = Array.from({ length: 11 }, (_, i) => String(2020 + i)) // 2020–2030

function isBatchRequired(role: UserRole | null) {
  return role === 'alumni' || role === 'student'
}

function isDeptRequired(role: UserRole | null) {
  return role === 'faculty' || role === 'alumni' || role === 'student'
}

function validate(
  fullName: string,
  password: string,
  confirmPassword: string,
  role: UserRole | null,
  department: string,
  batchSemester: string,
  batchYear: string,
) {
  const errs: Record<string, string> = {}
  if (!fullName.trim()) errs.fullName = 'Full name is required'
  if (!/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(password))
    errs.password = 'Must be 8+ chars with a number, uppercase, and symbol.'
  if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
  if (isDeptRequired(role) && !department.trim()) errs.department = 'Department is required'
  if (isBatchRequired(role) && !batchSemester) errs.batchSemester = 'Select a semester'
  if (isBatchRequired(role) && !batchYear) errs.batchYear = 'Select a year'
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
  const [batchSemester, setBatchSemester]   = useState('')
  const [batchYear, setBatchYear]           = useState('')

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
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              Create your account
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
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

        <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <a href={PATHS.LOGIN} style={{ color: 'var(--uc-indigo-l)', textDecoration: 'none' }}>
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
          <p style={{ margin: 0, fontSize: 14, color: 'var(--uc-orange-l)' }}>{inviteError}</p>
        </div>
      </RegisterShell>
    )
  }

  const role = inviteData?.role ?? null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setServerError(null)

    const errs = validate(fullName, password, confirmPassword, role, department, batchSemester, batchYear)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    const batchYearString =
      isBatchRequired(role) ? `${batchSemester} ${batchYear}` : undefined

    setLoading(true)
    try {
      const { data } = await api.post<RegisterResponse>('/auth/register', {
        token,
        password,
        fullName: fullName.trim(),
        ...(isDeptRequired(role) && department.trim() ? { department: department.trim() } : {}),
        ...(batchYearString ? { batch_year: batchYearString } : {}),
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
        } else if (status === 422 && code === 'EMAIL_DOMAIN_NOT_ALLOWED') {
          setServerError('Your email domain is not permitted to register at this university.')
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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            Create your account
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            You're registering with invitation code{' '}
            <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{token}</span>
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
              placeholder="Full name"
              style={inputStyle}
            />
          </Field>

          <Field label="Password" error={fieldErrors.password}>
            <PasswordInput
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              style={inputStyle}
            />
          </Field>

          <Field label="Confirm password" error={fieldErrors.confirmPassword}>
            <PasswordInput
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </Field>

          {/* University display — admin only */}
          {role === 'admin' && inviteData?.universityName && (
            <div style={{
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-sm)',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>University</span>
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{inviteData.universityName}</span>
            </div>
          )}

          {/* Department — required for faculty, alumni, student */}
          {isDeptRequired(role) && (
            <Field label="Department" error={fieldErrors.department}>
              <input
                type="text"
                autoComplete="off"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. CSE"
                maxLength={100}
                style={inputStyle}
              />
            </Field>
          )}

          {/* Batch dropdowns — alumni (graduation) and student (admission) */}
          {isBatchRequired(role) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {role === 'alumni' ? 'Graduation trimester' : 'Admission trimester'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <select
                    value={batchSemester}
                    onChange={(e) => setBatchSemester(e.target.value)}
                    required
                    style={selectStyle}
                  >
                    <option value="">Semester</option>
                    {SEMESTERS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {fieldErrors.batchSemester && (
                    <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{fieldErrors.batchSemester}</span>
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <select
                    value={batchYear}
                    onChange={(e) => setBatchYear(e.target.value)}
                    required
                    style={selectStyle}
                  >
                    <option value="">Year</option>
                    {BATCH_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  {fieldErrors.batchYear && (
                    <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{fieldErrors.batchYear}</span>
                  )}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {role === 'alumni'
                  ? "Enter the trimester you graduated. This determines which batch group you'll be added to."
                  : "Enter the trimester you were admitted. This determines which batch group you'll be added to."}
              </p>
            </div>
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

      <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
        Already have an account?{' '}
        <a href={PATHS.LOGIN} style={{ color: 'var(--uc-indigo-l)', textDecoration: 'none' }}>
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
      position: 'relative',
    }}>
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <BrandLogo height={40} />
          </div>
          {children}
        </div>
      </div>
      <LandingFooter />
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
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{error}</span>}
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
}
