import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import { useConnectionAction } from '../hooks/useConnectionAction'
import { ConnectionRequestModal } from './ConnectionRequestModal'

interface Props {
  targetUserId: string
  targetName: string
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected'
  connectionId: string | null
  size?: 'sm' | 'md'
  onConnect?: () => void
}

const sizeStyles = {
  sm: { padding: '4px 12px', fontSize: 12 },
  md: { padding: '6px 16px', fontSize: 13 },
}

export function ConnectButton({
  targetUserId,
  targetName,
  connectionStatus,
  connectionId,
  size = 'md',
  onConnect,
}: Props) {
  const navigate = useNavigate()
  const { send, withdraw, accept, decline, remove } = useConnectionAction(targetUserId)
  const [modalOpen, setModalOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pendingDropdownRef = useRef<HTMLDivElement>(null)
  const connectedDropdownRef = useRef<HTMLDivElement>(null)

  const sz = sizeStyles[size]

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      const isClickInPendingDropdown = pendingDropdownRef.current && pendingDropdownRef.current.contains(e.target as Node)
      const isClickInConnectedDropdown = connectedDropdownRef.current && connectedDropdownRef.current.contains(e.target as Node)
      if (!isClickInPendingDropdown && !isClickInConnectedDropdown) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  const handleSend = (note?: string) => {
    send.mutate(note, {
      onSuccess: () => {
        setModalOpen(false)
        onConnect?.()
      },
    })
  }

  const handleMessage = async () => {
    setDropdownOpen(false)
    try {
      const res = await api.post<{ data: { id: string } }>('/conversations', {
        participantId: targetUserId,
      })
      navigate(PATHS.CONVERSATION.replace(':id', res.data.data.id))
    } catch {
      // fallback — navigate to messages list
      navigate(PATHS.MESSAGES)
    }
  }

  // ── Shared button base styles ──────────────────────────
  const pillBase: React.CSSProperties = {
    borderRadius: 'var(--r-pill)',
    cursor: 'pointer',
    fontWeight: 500,
    lineHeight: 1,
    transition: 'opacity 150ms',
    ...sz,
  }

  const primaryStyle: React.CSSProperties = {
    ...pillBase,
    background: 'var(--uc-indigo)',
    color: 'var(--uc-indigo-xl)',
    border: 'none',
  }

  const ghostStyle: React.CSSProperties = {
    ...pillBase,
    background: 'transparent',
    border: '0.5px solid var(--border-hover)',
    color: 'var(--text-secondary)',
  }

  // ── none → Connect ────────────────────────────────────
  if (connectionStatus === 'none') {
    return (
      <>
        <button
          ref={triggerRef}
          onClick={() => setModalOpen(true)}
          style={primaryStyle}
          disabled={send.isPending}
        >
          Connect
        </button>
        <ConnectionRequestModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          targetName={targetName}
          onSend={handleSend}
          isPending={send.isPending}
          triggerRef={triggerRef}
        />
      </>
    )
  }

  // ── pending_sent → Pending (with withdraw dropdown) ───
  if (connectionStatus === 'pending_sent') {
    return (
      <div ref={pendingDropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          style={{ ...ghostStyle, opacity: withdraw.isPending ? 0.6 : 1 }}
          disabled={withdraw.isPending}
        >
          Pending
        </button>
        {dropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              minWidth: 160,
              zIndex: 100,
              overflow: 'hidden',
            }}
          >
            <DropdownItem
              label="Withdraw request"
              danger
              onClick={() => {
                setDropdownOpen(false)
                withdraw.mutate()
              }}
            />
          </div>
        )}
      </div>
    )
  }

  // ── pending_received → Accept + Decline ───────────────
  if (connectionStatus === 'pending_received') {
    const id = connectionId ?? ''
    return (
      <div style={{ display: 'inline-flex', gap: 6 }}>
        <button
          onClick={() => accept.mutate(id)}
          disabled={accept.isPending || decline.isPending}
          style={{ ...primaryStyle, opacity: accept.isPending ? 0.6 : 1 }}
        >
          Accept
        </button>
        <button
          onClick={() => decline.mutate(id)}
          disabled={accept.isPending || decline.isPending}
          style={{ ...ghostStyle, opacity: decline.isPending ? 0.6 : 1 }}
        >
          Decline
        </button>
      </div>
    )
  }

  // ── connected → Connected (with message + remove dropdown) ──
  return (
    <div ref={connectedDropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setDropdownOpen((v) => !v)}
        style={{ ...ghostStyle, opacity: remove.isPending ? 0.6 : 1 }}
        disabled={remove.isPending}
      >
        Connected
      </button>
      {dropdownOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            minWidth: 160,
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <DropdownItem label="Message" onClick={handleMessage} />
          <DropdownItem
            label="Remove connection"
            danger
            onClick={() => {
              setDropdownOpen(false)
              remove.mutate()
            }}
          />
        </div>
      )}
    </div>
  )
}

// ── Local sub-component ────────────────────────────────────

interface DropdownItemProps {
  label: string
  danger?: boolean
  onClick: () => void
}

function DropdownItem({ label, danger = false, onClick }: DropdownItemProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        padding: '10px 14px',
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        border: 'none',
        textAlign: 'left',
        fontSize: 13,
        fontWeight: 400,
        color: danger ? 'var(--uc-red)' : 'var(--text-primary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
