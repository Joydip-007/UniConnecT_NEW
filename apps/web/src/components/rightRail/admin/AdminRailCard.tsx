import { motion } from 'framer-motion'
import { listItem } from '@/lib/motion'

/**
 * The admin rail's two widgets are both cards, unlike the member rail where only the
 * first slot gets the surface. That is the design: each is a self-contained console
 * panel — a queue and a scoreboard — not a feed of suggestions whose head is the only
 * framed part. `order` lets the pair swap on Insights (numbers first, since nothing on
 * that screen is itself actionable) without the manifest listing them twice.
 */
export function AdminRailCard({
  order,
  label,
  children,
}: {
  order: number
  label: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      variants={listItem}
      aria-label={label}
      style={{
        order,
        flexShrink: 0,
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
      }}
    >
      {children}
    </motion.section>
  )
}
