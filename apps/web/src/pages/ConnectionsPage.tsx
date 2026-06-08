import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { avatarColor, getInitials } from '@/utils/avatar'
import { PATHS } from '@/router/paths'
import {
  ConnectionCard,
  PendingRequestCard,
  useMyConnections,
  usePendingReceived,
  usePendingSent,
  useConnectionAction,
} from '@/features/connections'
import type { ConnectionRequest } from '@uniconnect/shared'

// ── Skeleton ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--surface-raised)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            height: 13,
            width: '40%',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-sm)',
          }}
        />
        <div
          style={{
            height: 11,
            width: '60%',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-sm)',
          }}
        />
      </div>
      <div
        style={{
          width: 70,
          height: 26,
          background: 'var(--surface-raised)',
          borderRadius: 'var(--r-pill)',
          flexShrink: 0,
        }}
      />
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '40px 24px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontSize: 14,
        fontWeight: 400,
      }}
    >
      {message}
    </div>
  )
}

// ── Error state ───────────────────────────────────────────

function ErrorState() {
  return (
    <div
      style={{
        padding: '40px 24px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: 14,
        fontWeight: 400,
      }}
    >
      Something went wrong. Please try again.
    </div>
  )
}

// ── SentRequestCard ───────────────────────────────────────

function SentRequestCard({ request }: { request: ConnectionRequest }) {
  const userId = request.addresseeId
  const { withdraw } = useConnectionAction(userId)
  const [confirming, setConfirming] = useState(false)

  // For sent requests the backend populates `addressee`, not `requester`
  const user = request.addressee
  const fullName = user?.fullName ?? 'Unknown'
  const initials = getInitials(fullName)
  const color = avatarColor(userId)

  const pillBase: React.CSSProperties = {
    borderRadius: 'var(--r-pill)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 12,
    padding: '4px 12px',
    lineHeight: 1,
    transition: 'opacity 150ms',
    fontFamily: 'inherit',
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Link to={PATHS.PROFILE.replace(':id', userId)} style={{ flexShrink: 0 }}>
        <Avatar
          initials={initials}
          color={color}
          size={44}
          src={user?.avatarUrl}
        />
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Link to={PATHS.PROFILE.replace(':id', userId)} style={{ textDecoration: 'none' }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
              }}
            >
              {fullName}
            </span>
          </Link>
          {user?.role && (
            <Badge variant={user.role === 'student' ? 'dept' : user.role === 'alumni' ? 'alumni' : 'neutral'}>
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </Badge>
          )}
        </div>
        {(user?.headline || user?.department) && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {user.headline ?? user.department}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {confirming ? (
          // Inline confirmation — replaces both action buttons
          <>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Withdraw?
            </span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{
                ...pillBase,
                background: 'transparent',
                border: '0.5px solid var(--border-hover)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                withdraw.mutate()
              }}
              disabled={withdraw.isPending}
              style={{
                ...pillBase,
                background: 'transparent',
                border: '0.5px solid var(--uc-red)',
                color: 'var(--uc-red)',
                opacity: withdraw.isPending ? 0.6 : 1,
              }}
            >
              Confirm
            </button>
          </>
        ) : (
          <>
            {/* "Pending" pill badge */}
            <span
              style={{
                borderRadius: 'var(--r-pill)',
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-default)',
                color: 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: 500,
                padding: '3px 10px',
                lineHeight: 1,
              }}
            >
              Pending
            </span>

            {/* Withdraw button — triggers inline confirmation */}
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={withdraw.isPending}
              style={{
                ...pillBase,
                background: 'transparent',
                border: '0.5px solid var(--border-hover)',
                color: 'var(--text-secondary)',
                opacity: withdraw.isPending ? 0.6 : 1,
              }}
            >
              Withdraw
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── SentTab ───────────────────────────────────────────────

function SentTab() {
  const { data, isLoading, isError } = usePendingSent()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (isError) return <ErrorState />

  const items = data?.items ?? []

  if (items.length === 0) return <EmptyState message="No sent requests" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((req) => (
        <SentRequestCard key={req.id} request={req} />
      ))}
    </div>
  )
}

// ── ReceivedTab ───────────────────────────────────────────

function ReceivedTab() {
  const { data, isLoading, isError } = usePendingReceived()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (isError) return <ErrorState />

  const items = data?.items ?? []

  if (items.length === 0) return <EmptyState message="No pending requests" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((req) => (
        <PendingRequestCard key={req.id} request={req} />
      ))}
    </div>
  )
}

// ── MyNetworkTab ──────────────────────────────────────────

function MyNetworkTab() {
  const [search, setSearch] = useState('')
  const { data, isLoading, isError } = useMyConnections()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (isError) return <ErrorState />

  const allItems = data?.items ?? []
  const filtered = search.trim()
    ? allItems.filter((c) =>
        (c.user?.fullName ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : allItems

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Search input */}
      <input
        type="search"
        placeholder="Search connections…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 14px',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-pill)',
          color: 'var(--text-primary)',
          fontSize: 13,
          fontWeight: 400,
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          message={
            search.trim()
              ? `No connections matching "${search}"`
              : "No connections yet. Start connecting!"
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((connection) => (
            <ConnectionCard key={connection.id} connection={connection} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ConnectionsPage ───────────────────────────────────────

type Tab = 'network' | 'received' | 'sent'

export default function ConnectionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('network')
  const { data: receivedData } = usePendingReceived()

  const pendingCount = receivedData?.total ?? 0

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'network', label: 'My network' },
    { id: 'received', label: 'Received', count: pendingCount > 0 ? pendingCount : undefined },
    { id: 'sent', label: 'Sent' },
  ]

  return (
    <div
      style={{
        padding: '20px 0 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Page header */}
      <h1
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
        }}
      >
        My network
      </h1>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '0.5px solid var(--border-default)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--uc-orange)'
                  : '2px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: -1,
                transition: 'color 150ms',
              }}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: 'var(--r-pill)',
                    background: 'var(--uc-orange)',
                    color: 'var(--uc-orange-l)',
                    fontSize: 10,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                >
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'network' && <MyNetworkTab />}
      {activeTab === 'received' && <ReceivedTab />}
      {activeTab === 'sent' && <SentTab />}
    </div>
  )
}
