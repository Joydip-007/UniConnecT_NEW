import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { Check, Monitor } from 'lucide-react'
import { normalizeUsername, usernameSchema } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { PasswordInput } from '@/components/PasswordInput'
import { PATHS } from '@/router/paths'
import {
  useActiveSessions,
  useCancelDeletion,
  useChangePassword,
  useDeactivateAccount,
  useDeletionRequest,
  useExportData,
  useRequestDeletion,
  useRevokeOtherSessions,
  useRevokeSession,
} from '../hooks/useAccountSettings'
import { useUpdateUsername, useUsernameAvailability } from '../hooks/useUsername'
import { SectionHeader } from './NotificationsSection'

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 0',
  borderTop: '0.5px solid var(--border-default)',
  fontSize: 14,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  padding: '0 12px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}

const pillButton: React.CSSProperties = {
  borderRadius: 'var(--r-pill)',
  border: '0.5px solid var(--border-default)',
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  background: 'var(--uc-indigo)',
  color: 'var(--uc-indigo-l)',
}

function deviceLabel(userAgent?: string): string {
  if (!userAgent) return 'Unknown device'
  if (/mobile/i.test(userAgent)) return 'Mobile browser'
  if (/chrome/i.test(userAgent)) return 'Chrome'
  if (/firefox/i.test(userAgent)) return 'Firefox'
  if (/safari/i.test(userAgent)) return 'Safari'
  if (/edg/i.test(userAgent)) return 'Edge'
  return 'Browser'
}

export default function AccountSection() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <SectionHeader title="Account" description="Your account details and security." />
        <div style={{ marginTop: 8 }}>
          <div style={{ ...rowStyle, borderTop: 'none' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Email</span>
            <span style={{ color: 'var(--text-primary)' }}>{user?.email ?? '—'}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-tertiary)' }}>Role</span>
            <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {user?.role ?? '—'}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: 'var(--text-tertiary)' }}>Verified</span>
            <span style={{ color: 'var(--text-primary)' }}>{user?.isVerified ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      <UsernamePanel />
      <ChangePasswordForm />
      <ActiveSessionsPanel />

      <DataExportPanel />
      <DeletionRequestPanel />

      <DeactivatePanel
        onDeactivated={() => {
          clearAuth()
          navigate(PATHS.LOGIN)
        }}
      />
    </div>
  )
}

function DataExportPanel() {
  const exportData = useExportData()

  function download() {
    exportData.mutate(undefined, {
      onSuccess: (bundle) => {
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `uniconnect-data-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Your data has been downloaded')
      },
      onError: () => toast.error('Could not export your data.'),
    })
  }

  return (
    <div style={{ borderTop: '0.5px solid var(--border-default)', paddingTop: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
        Download your data
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5, maxWidth: 460 }}>
        Get a copy of your profile, posts, comments, connections and settings as a JSON file. Private
        messages are not included.
      </p>
      <button
        type="button"
        onClick={download}
        disabled={exportData.isPending}
        style={{ ...pillButton, background: 'transparent', color: 'var(--text-primary)' }}
      >
        {exportData.isPending ? 'Preparing…' : 'Download your data'}
      </button>
    </div>
  )
}

function DeletionRequestPanel() {
  const { data: request, isLoading } = useDeletionRequest()
  const requestDeletion = useRequestDeletion()
  const cancelDeletion = useCancelDeletion()
  const [reason, setReason] = useState('')
  const MIN = 10
  const MAX = 1000

  if (isLoading) return null

  const pending = request?.status === 'pending'

  return (
    <div style={{ borderTop: '0.5px solid var(--border-default)', paddingTop: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
        Request account deletion
      </h3>

      {pending ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5, maxWidth: 460 }}>
            Your deletion request is pending review by an admin. You can withdraw it while it's still pending.
          </p>
          <div
            style={{
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              padding: '12px 14px',
              marginBottom: 12,
              maxWidth: 460,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Your reason</span>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{request?.reason}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              cancelDeletion.mutate(undefined, {
                onSuccess: () => toast.success('Deletion request withdrawn'),
                onError: () => toast.error('Could not withdraw the request.'),
              })
            }
            disabled={cancelDeletion.isPending}
            style={{ ...pillButton, background: 'transparent', color: 'var(--text-secondary)' }}
          >
            {cancelDeletion.isPending ? 'Withdrawing…' : 'Withdraw request'}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5, maxWidth: 460 }}>
            UniConnecT is invite-only, so accounts can't be deleted instantly. Tell us why you'd like to leave
            and an admin will review your request.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX))}
            placeholder="Why do you want to delete your account?"
            rows={3}
            style={{
              width: '100%',
              maxWidth: 460,
              display: 'block',
              padding: '10px 12px',
              background: 'var(--surface-page)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              color: 'var(--text-primary)',
              fontSize: 13,
              resize: 'vertical',
              marginBottom: 12,
            }}
          />
          <button
            type="button"
            disabled={reason.trim().length < MIN || requestDeletion.isPending}
            onClick={() =>
              requestDeletion.mutate(reason.trim(), {
                onSuccess: () => {
                  setReason('')
                  toast.success('Deletion request submitted for review')
                },
                onError: () => toast.error('Could not submit your request.'),
              })
            }
            style={{ ...pillButton, background: 'transparent', color: 'var(--uc-red)', borderColor: 'var(--uc-red)' }}
          >
            {requestDeletion.isPending ? 'Submitting…' : 'Request account deletion'}
          </button>
        </>
      )}
    </div>
  )
}

function UsernamePanel() {
  const current = useAuthStore((s) => s.user?.username ?? '')
  const [value, setValue] = useState(current)
  const [debounced, setDebounced] = useState(current)
  const updateUsername = useUpdateUsername()

  // Keep local state in sync if the stored username changes elsewhere.
  useEffect(() => {
    setValue(current)
    setDebounced(current)
  }, [current])

  // Debounce the value feeding the availability check.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(normalizeUsername(value)), 350)
    return () => clearTimeout(t)
  }, [value])

  const parsed = usernameSchema.safeParse(value)
  const normalized = parsed.success ? parsed.data : normalizeUsername(value)
  const changed = normalized !== current
  const formatError = !parsed.success ? parsed.error.issues[0]?.message ?? 'Invalid username' : null

  const checkEnabled = changed && parsed.success && debounced === normalized
  const { data: availability, isFetching } = useUsernameAvailability(normalized, checkEnabled)

  const isTaken = checkEnabled && availability?.available === false
  const isAvailable = checkEnabled && availability?.available === true
  const canSave = changed && parsed.success && isAvailable && !updateUsername.isPending

  function save() {
    if (!canSave) return
    updateUsername.mutate(normalized, {
      onSuccess: () => toast.success('Username updated.'),
      onError: (err) => {
        const status = err instanceof AxiosError ? err.response?.status : undefined
        toast.error(status === 409 ? 'That username is already taken.' : 'Could not update username.')
      },
    })
  }

  let status: { text: string; color: string } | null = null
  if (!changed) status = null
  else if (formatError) status = { text: formatError, color: 'var(--uc-red)' }
  else if (isFetching || debounced !== normalized) status = { text: 'Checking…', color: 'var(--text-tertiary)' }
  else if (isTaken) {
    const reason = availability?.reason
    status = {
      text: reason === 'reserved' ? 'This username is reserved.' : 'That username is taken.',
      color: 'var(--uc-red)',
    }
  } else if (isAvailable) status = { text: 'Available', color: 'var(--uc-green, #2e9e5b)' }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
        Username
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5, maxWidth: 460 }}>
        Your public profile link is uniconnectt.me/profile/<span style={{ color: 'var(--text-secondary)' }}>{normalized || 'username'}</span>
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 12, color: 'var(--text-tertiary)', fontSize: 14 }}>@</span>
          <input
            style={{ ...inputStyle, paddingLeft: 26 }}
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Username"
          />
          {isAvailable && (
            <span style={{ position: 'absolute', right: 12, color: 'var(--uc-green, #2e9e5b)', lineHeight: 0 }}>
              <Check size={16} strokeWidth={2} />
            </span>
          )}
        </div>
        {status && <span style={{ fontSize: 12, color: status.color }}>{status.text}</span>}
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          style={{ ...pillButton, alignSelf: 'flex-start', opacity: canSave ? 1 : 0.6 }}
        >
          {updateUsername.isPending ? 'Saving…' : 'Save username'}
        </button>
      </div>
    </div>
  )
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const changePassword = useChangePassword()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    if (next !== confirm) {
      toast.error('New passwords do not match.')
      return
    }
    changePassword.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          toast.success('Password changed.')
          setCurrent('')
          setNext('')
          setConfirm('')
        },
        onError: () => toast.error('Could not change password. Check your current password.'),
      },
    )
  }

  return (
    <form onSubmit={submit}>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>
        Change password
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
        <PasswordInput
          style={inputStyle}
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <PasswordInput
          style={inputStyle}
          autoComplete="new-password"
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <PasswordInput
          style={inputStyle}
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <button
          type="submit"
          disabled={changePassword.isPending || !current || !next}
          style={{ ...pillButton, alignSelf: 'flex-start', opacity: changePassword.isPending ? 0.6 : 1 }}
        >
          {changePassword.isPending ? 'Saving…' : 'Update password'}
        </button>
      </div>
    </form>
  )
}

function ActiveSessionsPanel() {
  const { data: sessions, isLoading } = useActiveSessions()
  const revoke = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()

  const hasOthers = (sessions ?? []).some((s) => !s.isCurrent)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Active sessions</h3>
        {hasOthers && (
          <button
            type="button"
            onClick={() =>
              revokeOthers.mutate(undefined, {
                onSuccess: (r) => toast.success(`Logged out ${r.revoked} other device${r.revoked === 1 ? '' : 's'}.`),
              })
            }
            disabled={revokeOthers.isPending}
            style={{
              ...pillButton,
              background: 'transparent',
              color: 'var(--text-secondary)',
            }}
          >
            Log out other devices
          </button>
        )}
      </div>

      {isLoading ? (
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : (
        (sessions ?? []).map((s) => (
          <div key={s.id} style={{ ...rowStyle, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
              <Monitor size={16} />
              <span>
                {deviceLabel(s.deviceInfo?.userAgent)}
                {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                {s.isCurrent && (
                  <span style={{ color: 'var(--uc-indigo-l)', fontSize: 12, marginLeft: 8 }}>This device</span>
                )}
              </span>
            </span>
            {!s.isCurrent && (
              <button
                type="button"
                onClick={() => revoke.mutate(s.id)}
                disabled={revoke.isPending}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--uc-red)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Revoke
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function DeactivatePanel({ onDeactivated }: { onDeactivated: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const deactivate = useDeactivateAccount()

  return (
    <div style={{ borderTop: '0.5px solid var(--border-default)', paddingTop: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
        Deactivate account
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5, maxWidth: 460 }}>
        Your profile and content will be hidden and you'll be signed out everywhere. Nothing is deleted —
        log back in any time to reactivate.
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{ ...pillButton, background: 'transparent', color: 'var(--uc-red)', borderColor: 'var(--uc-red)' }}
        >
          Deactivate account
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() =>
              deactivate.mutate(undefined, {
                onSuccess: onDeactivated,
                onError: () => toast.error('Could not deactivate account.'),
              })
            }
            disabled={deactivate.isPending}
            style={{ ...pillButton, background: 'var(--uc-red)', color: 'var(--text-primary)' }}
          >
            {deactivate.isPending ? 'Deactivating…' : 'Yes, deactivate'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            style={{ ...pillButton, background: 'transparent', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
