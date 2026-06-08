import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '@/lib/axios'
import { PrimaryBtn } from '@/components/Button'
import { BrandLogo } from '@/components/BrandLogo'
import { PasswordInput } from '@/components/PasswordInput'
import { PATHS } from '@/router/paths'
import { MinimalPageFooter } from '@/components/MinimalPageFooter'

type Step = 'email' | 'otp' | 'password' | 'success'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')

  // Shared state across steps
  const [email, setEmailValue] = useState('')
  const [otp, setOtp] = useState('')

  function handleEmailDone(confirmedEmail: string) {
    setEmailValue(confirmedEmail)
    setStep('otp')
  }

  function handleOtpDone(confirmedOtp: string) {
    setOtp(confirmedOtp)
    setStep('password')
  }

  function handleSuccess() {
    setStep('success')
  }

  if (step === 'email') {
    return (
      <Shell>
        <EmailStep onDone={handleEmailDone} />
      </Shell>
    )
  }

  if (step === 'otp') {
    return (
      <Shell>
        <OtpStep email={email} onDone={handleOtpDone} />
      </Shell>
    )
  }

  if (step === 'password') {
    return (
      <Shell>
        <PasswordStep email={email} otp={otp} onDone={handleSuccess} />
      </Shell>
    )
  }

  return (
    <Shell>
      <SuccessStep onNavigate={() => navigate(PATHS.LOGIN, { replace: true })} />
    </Shell>
  )
}

// ─── Step 1: Email ────────────────────────────────────────────────────────────

function EmailStep({ onDone }: { onDone: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/resend-otp', { email: email.trim().toLowerCase(), purpose: 'reset' })
      onDone(email.trim().toLowerCase())
    } catch (err) {
      if (!isAxiosError(err) || !err.response) {
        setError('Connection error. Please check your internet and try again.')
        return
      }
      const status = err.response.status
      if (status === 429) {
        setError('Too many requests. Please wait a moment and try again.')
      } else if (status >= 500) {
        setError('Something went wrong on our end. Please try again.')
      } else {
        // Always advance on 4xx (including 404 for unknown email) — prevents email enumeration
        onDone(email.trim().toLowerCase())
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={cardStyle}>
      <div>
        <h1 style={headingStyle}>Reset your password</h1>
        <p style={subStyle}>
          Enter your university email and we'll send you a 6-digit reset code.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Email</span>
          <input
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@uiu.ac.bd"
            style={inputStyle}
          />
        </label>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <PrimaryBtn
          type="submit"
          disabled={loading || !email.trim()}
          style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
        >
          {loading ? 'Sending code…' : 'Send reset code'}
        </PrimaryBtn>
      </form>

      <BackToLogin />
    </div>
  )
}

// ─── Step 2: OTP ─────────────────────────────────────────────────────────────

function OtpStep({ email, onDone }: { email: string; onDone: (otp: string) => void }) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(60)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null))
  const isSubmitting = useRef(false)

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (resendCountdown <= 0) return
    const id = setTimeout(() => setResendCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCountdown])

  // We can't verify the reset OTP without also providing the new password (API design).
  // So just collect the OTP here and pass it forward — the password step submits them together.
  function handleSubmitOtp(value: string) {
    if (isSubmitting.current) return
    if (value.length !== 6 || !/^\d{6}$/.test(value)) {
      setError('Please enter the 6-digit code.')
      return
    }
    isSubmitting.current = true
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      isSubmitting.current = false
      onDone(value)
    }, 200)
  }

  function handleChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    if (digit) {
      if (index < 5) inputRefs.current[index + 1]?.focus()
      if (next.every((d) => d !== '')) void handleSubmitOtp(next.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? ''
    setDigits(next)
    inputRefs.current[Math.min(pasted.length - 1, 5)]?.focus()
    if (pasted.length >= 6) void handleSubmitOtp(pasted.slice(0, 6))
  }

  async function handleResend() {
    setResendLoading(true)
    setResendMessage(null)
    try {
      await api.post('/auth/resend-otp', { email, purpose: 'reset' })
      setResendCountdown(60)
      setResendMessage('A new code has been sent.')
    } catch {
      setResendMessage('Could not resend. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  const isFull = digits.every((d) => d !== '')

  return (
    <div style={cardStyle}>
      <div>
        <h1 style={headingStyle}>Enter the code</h1>
        <p style={subStyle}>
          We sent a 6-digit code to{' '}
          <span style={{ color: 'var(--text-primary)' }}>{email}</span>.
          Enter it below to continue.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={loading}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            style={{
              ...otpInputStyle,
              borderColor: error ? 'var(--uc-orange-bdr)' : 'var(--border-default)',
              opacity: loading ? 0.5 : 1,
            }}
          />
        ))}
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <PrimaryBtn
        type="button"
        disabled={loading || !isFull}
        onClick={() => void handleSubmitOtp(digits.join(''))}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {loading ? 'Continuing…' : 'Continue'}
      </PrimaryBtn>

      <div style={{ textAlign: 'center' }}>
        {resendMessage && (
          <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)' }}>
            {resendMessage}
          </p>
        )}
        {resendCountdown > 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
            Resend code in{' '}
            <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {resendCountdown}s
            </span>
          </p>
        ) : (
          <button
            type="button"
            disabled={resendLoading}
            onClick={() => void handleResend()}
            style={linkBtnStyle(resendLoading)}
          >
            {resendLoading ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>

      <BackToLogin />
    </div>
  )
}

// ─── Step 3: New password ─────────────────────────────────────────────────────

function PasswordStep({
  email,
  otp,
  onDone,
}: {
  email: string
  otp: string
  onDone: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function validate() {
    const errs: Record<string, string> = {}
    if (password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (password !== confirm) errs.confirm = 'Passwords do not match'
    return errs
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        email,
        otp,
        new_password: password,
      })
      onDone()
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        const code: string = err.response?.data?.code ?? ''
        if (status === 400 || status === 422 || code === 'INVALID_OTP') {
          setServerError('The code you entered is invalid or has expired. Please go back and try again.')
        } else if (status === 429) {
          setServerError('Too many attempts. Please wait a moment.')
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
    <div style={cardStyle}>
      <div>
        <h1 style={headingStyle}>Set a new password</h1>
        <p style={subStyle}>Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FieldWrapper label="New password" error={fieldErrors.password}>
          <PasswordInput
            autoComplete="new-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            style={inputStyle}
          />
        </FieldWrapper>

        <FieldWrapper label="Confirm password" error={fieldErrors.confirm}>
          <PasswordInput
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            style={inputStyle}
          />
        </FieldWrapper>

        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

        <PrimaryBtn
          type="submit"
          disabled={loading || !password || !confirm}
          style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
        >
          {loading ? 'Resetting…' : 'Reset password'}
        </PrimaryBtn>
      </form>

      <BackToLogin />
    </div>
  )
}

// ─── Step 4: Success ──────────────────────────────────────────────────────────

function SuccessStep({ onNavigate }: { onNavigate: () => void }) {
  const [countdown, setCountdown] = useState(4)

  useEffect(() => {
    if (countdown <= 0) {
      onNavigate()
      return
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown, onNavigate])

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {/* Checkmark */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--uc-indigo-bg)',
          border: '0.5px solid var(--uc-indigo-bdr)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="var(--uc-indigo-l)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ ...headingStyle, textAlign: 'center' }}>Password reset</h1>
          <p style={{ ...subStyle, textAlign: 'center' }}>
            Your password has been updated. Taking you to sign in…
          </p>
        </div>
      </div>

      <div style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-subtle)',
        borderRadius: 'var(--r-sm)',
        padding: '12px 16px',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
          Redirecting to sign in in{' '}
          <span style={{
            color: 'var(--uc-indigo-l)',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 500,
          }}>
            {countdown}s
          </span>
        </p>
      </div>

      <button
        type="button"
        onClick={onNavigate}
        style={linkBtnStyle(false)}
      >
        Go to sign in now
      </button>
    </div>
  )
}

// ─── Shared small components ──────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--surface-page)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
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
      </div>
      <MinimalPageFooter />
    </div>
  )
}

function FieldWrapper({
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
      <span style={labelStyle}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{error}</span>}
    </label>
  )
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: 0,
      fontSize: 13,
      color: 'var(--uc-orange-l)',
      background: 'var(--uc-orange-bg)',
      border: '0.5px solid var(--uc-orange-bdr)',
      borderRadius: 'var(--r-sm)',
      padding: '8px 12px',
    }}>
      {children}
    </p>
  )
}

function BackToLogin() {
  return (
    <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
      Remember it?{' '}
      <a href={PATHS.LOGIN} style={{ color: 'var(--uc-indigo-l)', textDecoration: 'none' }}>
        Sign in
      </a>
    </p>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-xl)',
  padding: '32px 28px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
}

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 500,
  color: 'var(--text-primary)',
  lineHeight: 1.3,
}

const subStyle: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: 13,
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
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

const otpInputStyle: React.CSSProperties = {
  width: 46,
  height: 56,
  textAlign: 'center',
  fontSize: 22,
  fontWeight: 500,
  background: 'var(--surface-raised)',
  border: '0.5px solid',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'monospace',
  caretColor: 'var(--uc-indigo)',
  transition: 'border-color 150ms',
  boxSizing: 'border-box',
}

function linkBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: 13,
    color: 'var(--uc-indigo-l)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit',
    textAlign: 'center',
    display: 'block',
    width: '100%',
  }
}
