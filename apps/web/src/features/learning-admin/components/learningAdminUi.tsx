import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cardStyle, fieldLabelStyle } from './learningAdminUi.styles'

/**
 * Primitives for the admin Learning screen. Sizes, paddings and token choices are lifted
 * verbatim from the design (Feed Page → admin → Learning) so every surface there reads
 * the same: 12px chips, 24px stat values, 0.5px borders, pill buttons.
 */

interface ChipProps {
  label: string
  active: boolean
  onClick: () => void
}

/** Filter / selector chip: indigo tint when on, raised surface when off. */
export function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: '6px 12px',
        borderRadius: 'var(--r-pill)',
        cursor: 'pointer',
        background: active ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
        border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
        color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </button>
  )
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
}

export interface StatSpec {
  label: string
  value: string
  sub: string
}

export function StatGrid({ stats }: { stats: StatSpec[] }) {
  return (
    <div className="learn-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ ...cardStyle, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.label}
          </div>
          <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)', marginTop: 4, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  )
}

type Tone = 'ghost' | 'tint' | 'solid'

interface SmallBtnProps {
  tone: Tone
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
  children: ReactNode
  /** Design uses 5px 12px inside cards/rows and 7px 14px on toolbars. */
  size?: 'row' | 'bar'
  type?: 'button' | 'submit'
  ariaLabel?: string
}

const TONES: Record<Tone, CSSProperties> = {
  ghost: { color: 'var(--text-secondary)', background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)' },
  tint: { color: 'var(--uc-indigo-xl)', background: 'var(--uc-indigo-bg)', border: '0.5px solid var(--uc-indigo-bdr)' },
  solid: { color: 'var(--on-indigo)', background: 'var(--uc-indigo)', border: 'none' },
}

export function SmallBtn({ tone, onClick, disabled, icon, children, size = 'row', type = 'button', ariaLabel }: SmallBtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        padding: size === 'bar' ? '7px 14px' : '5px 12px',
        borderRadius: 'var(--r-pill)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        fontFamily: 'inherit',
        ...TONES[tone],
      }}
    >
      {icon}
      {children}
    </button>
  )
}

interface StatusPillProps {
  label: string
  color: string
  bg: string
  bdr: string
}

export function StatusPill({ label, color, bg, bdr }: StatusPillProps) {
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 500,
        color,
        background: bg,
        border: `0.5px solid ${bdr}`,
        borderRadius: 'var(--r-pill)',
        padding: '2px 10px',
      }}
    >
      {label}
    </span>
  )
}

/** Orange icon tile that fronts every path card and quiz row. */
export function IconTile({ size, children }: { size: number; children: ReactNode }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--r-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: 'var(--uc-orange-bg)',
        color: 'var(--uc-orange-l)',
      }}
    >
      {children}
    </span>
  )
}

export function ProgressBar({ pct, height, color = 'var(--uc-indigo)' }: { pct: number; height: number; color?: string }) {
  return (
    <div style={{ height, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 'var(--r-pill)', background: color, width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </div>
  )
}

/**
 * Modal chrome from the design's AI dialogs: icon + title/sub header, scroll body,
 * right-aligned footer. Self-contained (portal, Escape, click-outside) because the
 * shared `Modal` paints its own text-only header, which the design does not have.
 */
export function DialogFrame({
  open,
  icon,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = 520,
}: {
  open: boolean
  icon: ReactNode
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  maxWidth?: number
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('input, textarea, button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      data-testid="learn-dialog-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        background: 'var(--overlay-bg-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: 'calc(100dvh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-hover)',
          borderRadius: 'var(--r-xl)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px', borderBottom: '0.5px solid var(--border-default)' }}>
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--r-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: 'var(--uc-indigo-bg)',
              color: 'var(--uc-indigo-xl)',
            }}
          >
            {icon}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, lineHeight: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        {/* The scroll box is a plain block: making it the flex column let its children
            shrink to fit, so nothing ever overflowed and the body could not scroll. */}
        <div style={{ overflowY: 'auto', minHeight: 0, flex: '1 1 auto' }}>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Footer buttons in the dialogs are 13px / 8px 16px — one step up from the row buttons. */
export function DialogBtn({ tone, onClick, disabled, icon, children }: Omit<SmallBtnProps, 'size' | 'type' | 'ariaLabel'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        fontWeight: 500,
        padding: '8px 16px',
        borderRadius: 'var(--r-pill)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        ...TONES[tone],
      }}
    >
      {icon}
      {children}
    </button>
  )
}
