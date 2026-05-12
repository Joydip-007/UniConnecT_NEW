import { useRef, useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import logoSrc from '@/assets/logo.svg'

export default function OtpPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const markVerified = useAuthStore((s) => s.markVerified)

  if (!accessToken || !user) return <Navigate to={PATHS.LOGIN} replace />
  if (user.isVerified) return <Navigate to={PATHS.FEED} replace />

  return <OtpForm email={user.email} onVerified={() => { markVerified(); navigate(PATHS.FEED, { replace: true }) }} />
}

function OtpForm({ email, onVerified }: { email: string; onVerified: () => void }) {
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

  async function submitOtp(otp: string) {
    if (isSubmitting.current) return
    isSubmitting.current = true
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/verify-otp', { email, otp })
      onVerified()
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : null
      setError(
        status === 400 || status === 422
          ? 'Invalid or expired code. Please try again.'
          : 'Something went wrong. Please try again.',
      )
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 0)
    } finally {
      setLoading(false)
      isSubmitting.current = false
    }
  }

  function handleChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    if (digit) {
      if (index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
      if (next.every((d) => d !== '')) {
        void submitOtp(next.join(''))
      }
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
    if (pasted.length >= 6) void submitOtp(pasted.slice(0, 6))
  }

  async function handleResend() {
    setResendLoading(true)
    setResendMessage(null)
    try {
      await api.post('/auth/resend-otp', { email })
      setResendCountdown(60)
      setResendMessage('A new code has been sent.')
    } catch {
      setResendMessage('Could not resend. Please try again.')
    } finally {
      setResendLoading(false)
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
          gap: 28,
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
            }}>
              Verify your email
            </h1>
            <p style={{
              margin: '8px 0 0',
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              We sent a 6-digit code to{' '}
              <span style={{ color: 'var(--text-primary)' }}>{email}</span>.
              Enter it below to continue.
            </p>
          </div>

          <div style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
          }}>
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

          {error && (
            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--uc-orange-l)',
              background: 'var(--uc-orange-bg)',
              border: '0.5px solid var(--uc-orange-bdr)',
              borderRadius: 'var(--r-sm)',
              padding: '8px 12px',
              textAlign: 'center',
            }}>
              {error}
            </p>
          )}

          <PrimaryBtn
            type="button"
            disabled={loading || digits.some((d) => d === '')}
            onClick={() => void submitOtp(digits.join(''))}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? 'Verifying…' : 'Verify'}
          </PrimaryBtn>

          <div style={{ textAlign: 'center' }}>
            {resendMessage && (
              <p style={{
                margin: '0 0 8px',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}>
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
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 13,
                  color: 'var(--uc-indigo-l)',
                  cursor: resendLoading ? 'not-allowed' : 'pointer',
                  opacity: resendLoading ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {resendLoading ? 'Sending…' : 'Resend code'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
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
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
}
