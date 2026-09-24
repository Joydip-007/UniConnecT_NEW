import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UserRole } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'

// ── Types ──────────────────────────────────────────────────────────────────────

type RedemptionStatus = 'pending' | 'fulfilled' | 'rejected'

interface Redemption {
  id: string
  status: RedemptionStatus
  pointsSpent: number
  codeText: string | null
  adminNote: string | null
  requestedAt: string
  fulfilledAt: string | null
  user: { id: string; email: string; fullName: string; avatarUrl: string | null; role?: UserRole }
  giftCard: { id: string; vendor: string; title: string; valueUsdCents: number }
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
}

const STATUSES: RedemptionStatus[] = ['pending', 'fulfilled', 'rejected']

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useRedemptions(status: RedemptionStatus) {
  return useQuery<Paginated<Redemption>>({
    queryKey: ['admin', 'mentorship', 'redemptions', { status }],
    queryFn: () =>
      api
        .get<{ data: Paginated<Redemption> }>('/admin/mentorship/redemptions', {
          params: { status, page: 1, limit: 30 },
        })
        .then((r) => r.data.data),
  })
}

function useUpdateRedemption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      redemptionId: string
      status: Exclude<RedemptionStatus, 'pending'>
      codeText?: string
      adminNote?: string
    }) =>
      api
        .patch(`/admin/mentorship/redemptions/${vars.redemptionId}`, {
          status: vars.status,
          ...(vars.codeText ? { codeText: vars.codeText } : {}),
          ...(vars.adminNote ? { adminNote: vars.adminNote } : {}),
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mentorship', 'redemptions'] })
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function statusTone(status: RedemptionStatus): { bg: string; color: string } {
  if (status === 'fulfilled') return { bg: 'var(--uc-mint-bg)', color: 'var(--uc-mint)' }
  if (status === 'rejected') return { bg: 'var(--uc-orange-bg)', color: 'var(--uc-orange-l)' }
  return { bg: 'var(--uc-amber-bg)', color: 'var(--uc-amber-l)' }
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

// ── Row ───────────────────────────────────────────────────────────────────────

function RedemptionRow({ redemption }: { redemption: Redemption }) {
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const update = useUpdateRedemption()
  const tone = statusTone(redemption.status)
  const pending = redemption.status === 'pending'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0', borderTop: '0.5px solid var(--border-default)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar
          src={redemption.user.avatarUrl}
          initials={getInitials(redemption.user.fullName)}
          color={seedColor(redemption.user.id)}
          size={36}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {redemption.user.role && <RoleBadge role={redemption.user.role} size={14} tipPlacement="below" />}
            {redemption.user.fullName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {redemption.giftCard.vendor} · {redemption.giftCard.title} · {fmtUsd(redemption.giftCard.valueUsdCents)}
          </div>
        </div>
        <span style={{
          fontSize: 12,
          padding: '3px 10px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--uc-indigo-bg)',
          color: 'var(--uc-indigo-xl)',
          flexShrink: 0,
        }}>
          {redemption.pointsSpent} points
        </span>
        <span style={{
          fontSize: 12,
          padding: '3px 10px',
          borderRadius: 'var(--r-pill)',
          background: tone.bg,
          color: tone.color,
          flexShrink: 0,
        }}>
          {redemption.status}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {fmtDate(redemption.requestedAt)}
        </span>
      </div>

      {redemption.codeText && (
        <span style={{
          alignSelf: 'flex-start',
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: 12,
          padding: '4px 10px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          color: 'var(--text-primary)',
        }}>
          {redemption.codeText}
        </span>
      )}

      {redemption.adminNote && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {redemption.adminNote}
        </p>
      )}

      {pending && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Gift card code"
            style={{ ...inputStyle, width: 200 }}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            style={{ ...inputStyle, width: 220 }}
          />
          <PrimaryBtn
            disabled={code.trim().length === 0 || update.isPending}
            onClick={() =>
              update.mutate({
                redemptionId: redemption.id,
                status: 'fulfilled',
                codeText: code.trim(),
                adminNote: note.trim() || undefined,
              })
            }
          >
            Fulfil
          </PrimaryBtn>
          <GhostBtn
            disabled={update.isPending}
            onClick={() =>
              update.mutate({
                redemptionId: redemption.id,
                status: 'rejected',
                adminNote: note.trim() || undefined,
              })
            }
          >
            Reject
          </GhostBtn>
        </div>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function RewardRequestsPanel() {
  const [status, setStatus] = useState<RedemptionStatus>('pending')
  const { data, isLoading } = useRedemptions(status)

  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
          Reward requests
        </p>
        {STATUSES.map((s) => {
          const active = s === status
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              style={{
                padding: '5px 14px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {s}
            </button>
          )
        })}
      </div>

      {isLoading && (
        <p style={{ margin: 0, padding: '24px 0', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          Loading reward requests
        </p>
      )}

      {!isLoading && data && data.items.length === 0 && (
        <p style={{ margin: 0, padding: '24px 0', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          No {status} reward requests
        </p>
      )}

      {data?.items.map((r) => (
        <RedemptionRow key={r.id} redemption={r} />
      ))}
    </div>
  )
}
