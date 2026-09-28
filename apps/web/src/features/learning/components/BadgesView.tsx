import { useEffect, useRef } from 'react'
import { ArrowLeft, Pin } from 'lucide-react'
import {
  BADGE_CATEGORY_META, badgeSummary, buildBadgeFilters, type BadgeCard, type BadgeFilterKey,
} from '../badgeLadders'
import { FilterChip, ProgressBar, RoundIconButton } from './learnUi'

interface BadgesViewProps {
  cards: BadgeCard[]
  filter: BadgeFilterKey
  onFilter: (key: BadgeFilterKey) => void
  /** Card key to outline, when arriving from the streak card's badge stack. */
  focusKey: string | null
  onBack: () => void
  onTogglePin: (card: BadgeCard) => void
  compact?: boolean
}

export function BadgesView({ cards, filter, onFilter, focusKey, onBack, onTogglePin, compact = false }: BadgesViewProps) {
  const visible = cards.filter((c) => filter === 'all' || c.category === filter)
  const focusRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    focusRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [focusKey])

  return (
    <section aria-label="Badges" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RoundIconButton label="Back to Learn" onClick={onBack} outlined size={compact ? 40 : 32}>
          <ArrowLeft size={16} />
        </RoundIconButton>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Your badges</h2>
      </div>

      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{badgeSummary(cards)}</span>

      <div className="hide-bar" style={{ display: 'flex', gap: 6, flexWrap: compact ? 'nowrap' : 'wrap', overflowX: compact ? 'auto' : undefined }}>
        {buildBadgeFilters(cards).map((f) => (
          <FilterChip key={f.key} on={filter === f.key} onClick={() => onFilter(f.key)}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      {visible.length === 0 ? (
        <p style={{ margin: 0, padding: '24px 0', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          No badges here yet.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(168px, 1fr))',
            gap: compact ? 8 : 10,
          }}
        >
          {visible.map((card) => {
            const meta = BADGE_CATEGORY_META[card.category]
            const Icon = meta.icon
            const focused = card.key === focusKey
            return (
              <button
                key={card.key}
                ref={focused ? focusRef : undefined}
                type="button"
                onClick={() => card.earned && onTogglePin(card)}
                aria-pressed={card.pinned}
                aria-disabled={!card.earned}
                title={card.earned ? (card.pinned ? 'Unpin from your profile' : 'Pin to your profile') : 'Not earned yet'}
                className="interactive-surface"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  minWidth: 0,
                  textAlign: 'left',
                  background: 'var(--surface-card)',
                  border: focused
                    ? '1.5px solid var(--uc-indigo)'
                    : card.pinned
                      ? '0.5px solid var(--uc-indigo-bdr)'
                      : '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-lg)',
                  padding: compact ? 12 : 14,
                  cursor: card.earned ? 'pointer' : 'default',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, width: '100%' }}>
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      background: card.earned ? `var(--uc-${meta.tone})` : 'var(--surface-raised)',
                      border: card.earned ? 'none' : '0.5px dashed var(--border-hover)',
                      color: card.earned ? 'var(--on-accent)' : 'var(--text-tertiary)',
                    }}
                  >
                    <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 500,
                      color: card.earned ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    }}
                  >
                    {card.pinned && <Pin size={12} color="var(--uc-indigo-l)" aria-label="Pinned" />}
                    {card.tierLabel}
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: card.earned ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {card.name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, lineHeight: 1.4, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>
                    {card.criteria}
                  </p>
                </div>
                {card.hasNext ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5, marginTop: 'auto' }}>
                    <ProgressBar pct={card.progressPct} color={`var(--uc-${meta.tone})`} />
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                      {card.progressLabel}
                    </span>
                  </div>
                ) : card.earned ? (
                  <span style={{ marginTop: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Held by {card.heldByPct}% of learners
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
