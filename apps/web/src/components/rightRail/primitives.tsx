import { motion } from 'framer-motion'
import { listItem } from '@/lib/motion'

/**
 * Chrome shared by every right-rail widget. Extracted verbatim from the pre-split
 * `RightSidebar` so the widgets keep their shipped look — card, flat section, header,
 * skeleton — while each one owns its own data and can hide itself.
 */

export function Widget({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}

export function Section({
  children,
  withTopDivider = false,
}: {
  children: React.ReactNode
  withTopDivider?: boolean
}) {
  return (
    <div
      style={{
        padding: '14px 4px 4px',
        flexShrink: 0,
        borderTop: withTopDivider ? '0.5px solid var(--border-default)' : 'none',
      }}
    >
      {children}
    </div>
  )
}

export function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="press-feedback"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--uc-indigo-l)',
            padding: 0,
          }}
        >
          See all
        </button>
      )}
    </div>
  )
}

/**
 * The 11px eyebrow tier. Per the design system this is `--text-label`, never
 * `--text-tertiary` — that token is for 12px meta, timestamps and placeholders.
 */
export function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--text-label)',
        letterSpacing: '0.04em',
        marginBottom: 8,
        paddingLeft: 2,
      }}
    >
      {children}
    </div>
  )
}

export function SkeletonLine({
  width = '100%',
  height = 12,
}: {
  width?: string | number
  height?: number
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 'var(--r-sm)',
        background: 'var(--surface-raised)',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}

/** Every widget enters on the rail's shared stagger. */
export function WidgetShell({ children }: { children: React.ReactNode }) {
  return <motion.div variants={listItem}>{children}</motion.div>
}
