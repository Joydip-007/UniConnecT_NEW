import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Check } from 'lucide-react'
import { api } from '@/lib/axios'
import { Modal } from '@/components/Modal'
import { GhostBtn, PrimaryBtn } from '@/components/Button'

/**
 * Every route into this university runs through this one dialog. It used to be three
 * separate panels stacked down the Members tab — a single-invite form, a bulk form, and
 * a standalone "Add driver" card — which meant the page's own primary button was the
 * one thing that could not actually invite anybody.
 *
 * Driver is on the same role row as the rest but takes a different form, because it
 * takes a different endpoint: `POST /admin/users/driver` creates the account outright
 * with a password, while every other role gets an invitation token and completes its
 * own registration. That is a real asymmetry in the API, not a UI choice, so the dialog
 * states it rather than hiding it behind a control that would quietly do something else.
 */

type InvitableRole = 'student' | 'alumni' | 'faculty' | 'admin'
type Role = InvitableRole | 'driver'

const ROLES: { value: Role; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'admin', label: 'Admin' },
  { value: 'driver', label: 'Driver' },
]

/** `expires_in_days` is capped at 30 by `CreateInvitationSchema`. */
const EXPIRY_OPTIONS = [3, 7, 14, 30]

/** `CreateBulkInvitationsSchema` takes at most 50 addresses in one batch. */
const MAX_BATCH = 50

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseEmails(text: string): string[] {
  return [...new Set(text.split(/[,\n]/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))]
}

function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback
  return (err.response?.data?.error as string | undefined) ?? fallback
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-label)',
  letterSpacing: '0.04em',
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  padding: '9px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
  outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

export function InvitePeopleDialog({
  isOpen,
  onClose,
  triggerRef,
}: {
  isOpen: boolean
  onClose: () => void
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}) {
  const qc = useQueryClient()

  const [role, setRole] = useState<Role>('student')
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [expiryDays, setExpiryDays] = useState(7)
  const [email, setEmail] = useState('')
  const [batchLabel, setBatchLabel] = useState('')
  const [batchText, setBatchText] = useState('')
  const [driverName, setDriverName] = useState('')
  const [driverPassword, setDriverPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const isDriver = role === 'driver'
  const emails = parseEmails(batchText)

  function reset() {
    setEmail('')
    setBatchLabel('')
    setBatchText('')
    setDriverName('')
    setDriverPassword('')
    setError(null)
  }

  function close() {
    reset()
    setDone(null)
    onClose()
  }

  const refreshInvites = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'invitations'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'invite-batches'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
  }

  const single = useMutation({
    mutationFn: () =>
      api.post('/admin/invitations', { email: email.trim(), role, expires_in_days: expiryDays }),
    onSuccess: () => {
      refreshInvites()
      setDone(`Invitation sent to ${email.trim()}`)
      reset()
    },
    onError: (e) => setError(errorMessage(e, 'Could not send the invitation.')),
  })

  const batch = useMutation({
    mutationFn: () =>
      api.post('/admin/invitations/bulk', {
        emails,
        role,
        expires_in_days: expiryDays,
        batch_label: batchLabel.trim(),
      }),
    onSuccess: () => {
      refreshInvites()
      setDone(`${emails.length} invitation${emails.length === 1 ? '' : 's'} sent`)
      reset()
    },
    onError: (e) => setError(errorMessage(e, 'Could not send the invitations.')),
  })

  const driver = useMutation({
    mutationFn: () =>
      api.post('/admin/users/driver', {
        full_name: driverName.trim(),
        email: email.trim(),
        password: driverPassword,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setDone(`Driver account created for ${email.trim()}`)
      reset()
    },
    onError: (e) => setError(errorMessage(e, 'Could not create the driver account.')),
  })

  const pending = single.isPending || batch.isPending || driver.isPending

  const canSubmit = isDriver
    ? driverName.trim().length > 0 && EMAIL_RE.test(email.trim()) && driverPassword.length >= 8
    : mode === 'single'
      ? EMAIL_RE.test(email.trim())
      : emails.length > 0 && emails.length <= MAX_BATCH && batchLabel.trim().length > 0

  function submit() {
    setError(null)
    setDone(null)
    if (isDriver) driver.mutate()
    else if (mode === 'single') single.mutate()
    else batch.mutate()
  }

  const submitLabel = isDriver
    ? 'Create driver account'
    : mode === 'single'
      ? 'Send invitation'
      : `Send ${emails.length || ''} invitation${emails.length === 1 ? '' : 's'}`.replace('  ', ' ')

  return (
    <Modal isOpen={isOpen} onClose={close} title="Invite people" maxWidth={480} triggerRef={triggerRef}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelStyle}>Invite as</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label="Invite as">
            {ROLES.map((r) => {
              const active = role === r.value
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setRole(r.value)
                    setError(null)
                    setDone(null)
                  }}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 'var(--r-pill)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: active ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
                    border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                    color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                  }}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>

        {isDriver ? (
          <>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Transport staff do not self-register, so a driver gets an account directly rather than an
              invitation. They can sign in as soon as you save this.
            </p>
            <Field label="Full name">
              <input
                style={fieldStyle}
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Jamal Uddin"
              />
            </Field>
            <Field label="Email address">
              <input
                type="email"
                style={fieldStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@transport.uiu.ac.bd"
              />
            </Field>
            <Field label="Temporary password">
              <input
                type="password"
                style={fieldStyle}
                value={driverPassword}
                onChange={(e) => setDriverPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </Field>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={labelStyle}>How many</span>
              <div
                style={{
                  display: 'inline-flex',
                  alignSelf: 'flex-start',
                  background: 'var(--surface-raised)',
                  border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-pill)',
                  padding: 3,
                }}
                role="radiogroup"
                aria-label="How many"
              >
                {(['single', 'batch'] as const).map((m) => {
                  const active = mode === m
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setMode(m)
                        setError(null)
                        setDone(null)
                      }}
                      style={{
                        padding: '5px 16px',
                        fontSize: 12,
                        fontWeight: active ? 500 : 400,
                        borderRadius: 'var(--r-pill)',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                        color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                      }}
                    >
                      {m === 'single' ? 'One person' : 'A batch'}
                    </button>
                  )
                })}
              </div>
            </div>

            {mode === 'single' ? (
              <Field label="Email address">
                <input
                  type="email"
                  style={fieldStyle}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit && !pending) submit()
                  }}
                  placeholder="name@uiu.ac.bd"
                />
              </Field>
            ) : (
              <>
                <Field label="Batch name">
                  <input
                    style={fieldStyle}
                    value={batchLabel}
                    onChange={(e) => setBatchLabel(e.target.value)}
                    placeholder="CSE Fall 2026 intake"
                  />
                </Field>
                <Field label="Email addresses">
                  <textarea
                    style={{ ...fieldStyle, minHeight: 110, resize: 'vertical', lineHeight: 1.5 }}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder="name@uiu.ac.bd, one per line or comma separated"
                  />
                </Field>
                <span
                  style={{
                    fontSize: 12,
                    marginTop: -8,
                    color: emails.length > MAX_BATCH ? 'var(--uc-red)' : 'var(--text-tertiary)',
                  }}
                >
                  {emails.length === 0
                    ? 'No addresses yet'
                    : emails.length > MAX_BATCH
                      ? `${emails.length} addresses — ${MAX_BATCH} is the most one batch can take`
                      : `${emails.length} address${emails.length === 1 ? '' : 'es'} ready`}
                </span>
              </>
            )}

            <Field label="Invitation expires in">
              <select
                style={{ ...fieldStyle, cursor: 'pointer' }}
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
              >
                {EXPIRY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {error && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--uc-red)',
              background: 'var(--uc-red-bg)',
              border: '0.5px solid var(--uc-red-bdr)',
              borderRadius: 'var(--r-sm)',
              padding: '8px 10px',
            }}
          >
            {error}
          </p>
        )}

        {done && (
          <p
            style={{
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--uc-mint)',
              background: 'var(--uc-mint-bg)',
              border: '0.5px solid var(--uc-mint-bdr)',
              borderRadius: 'var(--r-sm)',
              padding: '8px 10px',
            }}
          >
            <Check size={13} strokeWidth={1.5} />
            {done}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <GhostBtn onClick={close}>{done ? 'Done' : 'Cancel'}</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={!canSubmit || pending}>
            {pending ? 'Sending…' : submitLabel}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
