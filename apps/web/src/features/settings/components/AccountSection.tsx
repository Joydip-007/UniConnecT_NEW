import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Monitor } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from '@/router/paths'
import {
  useActiveSessions,
  useChangePassword,
  useDeactivateAccount,
  useRevokeOtherSessions,
  useRevokeSession,
} from '../hooks/useAccountSettings'
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

      <ChangePasswordForm />
      <ActiveSessionsPanel />

      <DeactivatePanel
        onDeactivated={() => {
          clearAuth()
          navigate(PATHS.LOGIN)
        }}
      />
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
        <input
          style={inputStyle}
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <input
          style={inputStyle}
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <input
          style={inputStyle}
          type="password"
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
