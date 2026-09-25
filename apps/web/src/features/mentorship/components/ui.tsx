import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import type { UserRole } from '@uniconnect/shared'
import { Avatar } from '@/components/Avatar'
import { ROLE_LABEL } from '@/components/RoleBadge.constants'
import { avatarColor, getInitials } from '@/utils/avatar'
import { btnStyle, eyebrowStyle, hairline } from './styles'
import type { BtnVariant } from './styles'

/**
 * The small, repeated pieces of Mentorship Page.dc.html — card surface, eyebrow, the
 * three button weights, pills and inline panels — so every screen reads from one set.
 */

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ ...eyebrowStyle, ...style }}>{children}</span>
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  height?: number
}

export function Btn({ variant = 'ghost', height = 32, style, disabled, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      {...rest}
      style={{ ...btnStyle(variant, height), ...(disabled ? { opacity: 0.5, cursor: 'default' } : null), ...style }}
    >
      {children}
    </button>
  )
}

/** A text-only action ("Undo", "Withdraw", "Clear all"). */
export function TextBtn({ style, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        fontSize: 12,
        background: 'none',
        border: 'none',
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: '4px 0',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/** The selectable pill used for slots, durations, reasons and filters. */
export function StatusPill({ tone, children }: { tone: 'mint' | 'neutral'; children: ReactNode }) {
  const mint = tone === 'mint'
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 9px',
        borderRadius: 'var(--r-pill)',
        background: mint ? 'var(--uc-mint-bg)' : 'var(--surface-raised)',
        border: mint ? '0.5px solid var(--uc-mint-bdr)' : hairline,
        color: mint ? 'var(--uc-mint)' : 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export function RolePill({ role }: { role: UserRole | null | undefined }) {
  if (!role) return null
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 7px',
        borderRadius: 'var(--r-pill)',
        background: `var(--role-${role}-bg)`,
        border: `0.5px solid var(--role-${role}-bdr)`,
        color: `var(--role-${role}-text)`,
        whiteSpace: 'nowrap',
      }}
    >
      {ROLE_LABEL[role]}
    </span>
  )
}

export function PersonAvatar({ id, name, src, size }: { id: string; name: string; src: string | null; size: number }) {
  return <Avatar src={src} initials={getInitials(name)} color={avatarColor(id)} size={size} />
}

export function Meter({ pct, color, height = 3 }: { pct: number; color: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color }} />
    </div>
  )
}

export function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>
      {children}
    </label>
  )
}

/** The raised in-card panel that opens under a header (request / log / end). */
export function InlinePanel({
  title,
  subtitle,
  onClose,
  role = 'region',
  children,
}: {
  title: string
  subtitle?: string
  onClose?: () => void
  role?: 'region' | 'alertdialog'
  children: ReactNode
}) {
  return (
    <div
      role={role}
      aria-label={title}
      style={{
        margin: '0 16px 14px',
        padding: 14,
        background: 'var(--surface-raised)',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
          {subtitle && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{subtitle}</span>}
        </div>
        {onClose && <CloseBtn onClick={onClose} />}
      </div>
      {children}
    </div>
  )
}

export function CloseBtn({ onClick, size = 14 }: { onClick: () => void; size?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <X size={size} />
    </button>
  )
}

/** A one-line status strip inside a card: "Session requested." / "Session logged." */
export function StatusStrip({
  tone,
  icon,
  lead,
  children,
  action,
  inset = true,
}: {
  tone: 'indigo' | 'mint' | 'plain'
  icon: ReactNode
  lead?: string
  children?: ReactNode
  action?: ReactNode
  inset?: boolean
}) {
  const bg = tone === 'indigo' ? 'var(--uc-indigo-bg)' : tone === 'mint' ? 'var(--uc-mint-bg)' : 'transparent'
  const border =
    tone === 'indigo' ? '0.5px solid var(--uc-indigo-bdr)' : tone === 'mint' ? '0.5px solid var(--uc-mint-bdr)' : 'none'
  return (
    <div
      role="status"
      style={{
        margin: inset ? '0 16px 14px' : 0,
        padding: '10px 12px',
        background: bg,
        border,
        borderRadius: 'var(--r-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ lineHeight: 0, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        {lead && <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{lead}</span>} {children}
      </span>
      {action}
    </div>
  )
}

/** Popover menu anchored under its trigger; closes on outside click and Escape. */
export function Popover({
  open,
  onClose,
  top,
  width,
  align = 'right',
  children,
  ariaLabel,
}: {
  open: boolean
  onClose: () => void
  top: number
  width: number | string
  align?: 'left' | 'right' | 'stretch'
  children: ReactNode
  ariaLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const parent = ref.current?.parentElement
      if (parent && !parent.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  const pos: CSSProperties =
    align === 'right' ? { right: 0 } : align === 'left' ? { left: 0 } : { left: 0, right: 0 }
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={ariaLabel}
      style={{
        position: 'absolute',
        top,
        ...pos,
        zIndex: 30,
        width: align === 'stretch' ? undefined : width,
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-hover)',
        borderRadius: 'var(--r-md)',
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  )
}

export function MenuItem({
  onClick,
  icon,
  danger,
  children,
}: {
  onClick: () => void
  icon?: ReactNode
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="mentorship-menu-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        minHeight: 36,
        padding: '8px 10px',
        border: 'none',
        background: 'transparent',
        borderRadius: 'var(--r-sm)',
        fontSize: 13,
        color: danger ? 'var(--uc-red)' : 'var(--text-primary)',
        fontFamily: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

/** The checkbox row inside the mentor filter popover. */
export function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onToggle}
      className="mentorship-menu-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: 8,
        border: 'none',
        background: 'transparent',
        borderRadius: 'var(--r-sm)',
        fontSize: 13,
        color: 'var(--text-primary)',
        fontFamily: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          boxSizing: 'border-box',
          borderRadius: 4,
          border: checked ? 'none' : '0.5px solid var(--border-strong)',
          background: checked ? 'var(--uc-indigo)' : 'transparent',
          color: 'var(--on-indigo)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {checked && <Check size={11} />}
      </span>
      {label}
    </button>
  )
}
