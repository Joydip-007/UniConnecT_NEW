import { motion } from 'framer-motion'
import { listItem } from '@/lib/motion'

/**
 * Chrome shared by every right-rail widget. Extracted verbatim from the pre-split
 * `RightSidebar` so the widgets keep their shipped look — card, flat section, header,
 * skeleton — while each one owns its own data and can hide itself.
 */

/**
 * Every widget's outer box. The chrome itself is positional and lives in CSS
 * (`.right-rail-slot` in index.css): the first *rendered* widget gets the card
 * surface, the rest are flat sections with a hairline from the third onward.
 *
 * It has to be positional rather than per-widget because `ROLE_SHELL[role].rightRail`
 * orders the column differently per role — a widget that hardcoded "card" only looked
 * right in the one role whose list happened to start with it, and every other role got
 * a borderless column with no head. A widget that hides itself renders no element at
 * all, so `:first-child` tracks what the reader actually sees.
 */
export function RailSlot({ children }: { children: React.ReactNode }) {
  return <div className="right-rail-slot">{children}</div>
}

/**
 * Title only — deliberately no "See all" escape hatch. Every page a widget could link
 * out to (`/events`, `/explore`) is already a left-rail row, so the button was the rail
 * repeated inside the rail's own neighbour. A widget's job is the specific items it
 * lists; getting to the full list is the left rail's job.
 */
export function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
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

/**
 * A standalone rail card for page-scoped rails (`usePageRails`): every card carries its
 * own surface and an eyebrow title, unlike the manifest widgets whose chrome is
 * positional. Used by the news and lost & found rails.
 */
export function PageRailCard({
  title,
  action,
  gap = 12,
  children,
}: {
  title?: string
  action?: React.ReactNode
  gap?: number
  children: React.ReactNode
}) {
  return (
    <section
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap,
        flexShrink: 0,
      }}
    >
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {title && (
            <h2 style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)' }}>
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
