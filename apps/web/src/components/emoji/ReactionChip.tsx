import { useEffect, useRef } from 'react'
import { TwemojiIcon } from './TwemojiIcon'
import { REACTION_MAP, totalReactions, topReactions } from './reactionConfig'
import type { ReactionKey, MessageReactionKey } from './reactionConfig'

interface ReactionChipProps {
  counts: Record<string, number>
  myReaction: ReactionKey | null
  /** Fires a pop animation on the chip when this changes */
  animateKey?: string | null
  onClick?: () => void
}

export function ReactionChip({ counts, myReaction, animateKey, onClick }: ReactionChipProps) {
  const total = totalReactions(counts)
  const top = topReactions(counts, 3)
  const chipRef = useRef<HTMLButtonElement>(null)
  const prevKey = useRef(animateKey)

  useEffect(() => {
    if (animateKey && animateKey !== prevKey.current && chipRef.current) {
      chipRef.current.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }],
        { duration: 300, easing: 'ease-out' },
      )
    }
    prevKey.current = animateKey
  }, [animateKey])

  if (total === 0) return null

  return (
    <button
      ref={chipRef}
      onClick={onClick}
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px 2px 4px',
        borderRadius: 'var(--r-pill)',
        border: myReaction
          ? '0.5px solid var(--uc-indigo)'
          : '0.5px solid var(--border-default)',
        background: myReaction ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
        cursor: onClick ? 'pointer' : 'default',
        fontSize: 12,
        fontWeight: 400,
        color: 'var(--text-secondary)',
        lineHeight: 1,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {top.map((r) => (
          <TwemojiIcon key={r.key} codepoint={r.codepoint} size={14} label={r.label} />
        ))}
      </span>
      {total}
    </button>
  )
}

interface MessageReactionGroupProps {
  reactions: Record<string, { userId: string; fullName: string }[]>
  myUserId: string
  onReactionClick: (key: MessageReactionKey) => void
}

export function MessageReactionGroup({ reactions, myUserId, onReactionClick }: MessageReactionGroupProps) {
  const keys = Object.keys(reactions).filter((k) => reactions[k].length > 0) as ReactionKey[]
  if (keys.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {keys.map((key) => {
        const config = REACTION_MAP.get(key)
        if (!config) return null
        const users = reactions[key]
        const isMine = users.some((u) => u.userId === myUserId)
        return (
          <button
            key={key}
            type="button"
            onClick={() => onReactionClick(key as MessageReactionKey)}
            title={users.map((u) => u.fullName).join(', ')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px 2px 4px',
              borderRadius: 'var(--r-pill)',
              border: isMine
                ? '0.5px solid var(--uc-indigo)'
                : '0.5px solid var(--border-default)',
              background: isMine ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
            }}
          >
            <TwemojiIcon codepoint={config.codepoint} size={13} label={config.label} />
            {users.length}
          </button>
        )
      })}
    </div>
  )
}
