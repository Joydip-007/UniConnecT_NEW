import React, { useEffect, useRef, useState } from 'react'
import { TwemojiIcon } from './TwemojiIcon'
import { REACTIONS, MESSAGE_REACTIONS } from './reactionConfig'
import type { ReactionKey, MessageReactionKey } from './reactionConfig'

interface ReactionBarPopoverProps {
  onSelect: (key: ReactionKey) => void
  onClose: () => void
}

/** Hover popover for posts/comments — all 7 reactions */
export function ReactionBarPopover({ onSelect, onClose }: ReactionBarPopoverProps) {
  return (
    <div
      role="menu"
      aria-label="React to post"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 10px',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-pill)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        userSelect: 'none',
      }}
      onMouseLeave={onClose}
    >
      {REACTIONS.map((r) => (
        <button
          key={r.key}
          type="button"
          role="menuitem"
          aria-label={r.label}
          onClick={() => { onSelect(r.key); onClose() }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 3,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 150ms ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.35)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          title={r.label}
        >
          <TwemojiIcon codepoint={r.codepoint} size={28} label={r.label} />
        </button>
      ))}
    </div>
  )
}

interface PostReactionTriggerProps {
  onSelect: (key: ReactionKey) => void
  children: React.ReactNode
}

/**
 * Wraps the Like button. On hover (200 ms delay) shows the full reaction popover.
 * Clicking the button directly toggles `like`.
 */
export function PostReactionTrigger({ onSelect, children }: PostReactionTriggerProps) {
  const [open, setOpen] = useState(false)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMouseEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = setTimeout(() => setOpen(true), 200)
  }

  function handleMouseLeave() {
    if (openTimer.current) clearTimeout(openTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 300)
  }

  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 6,
            zIndex: 50,
          }}
          onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current) }}
          onMouseLeave={handleMouseLeave}
        >
          <ReactionBarPopover onSelect={onSelect} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

interface MessageMiniReactionBarProps {
  onSelect: (key: MessageReactionKey) => void
  myReaction: MessageReactionKey | null
}

/** Floating mini-bar for individual chat messages — 6 reactions (no sad) */
export function MessageMiniReactionBar({ onSelect, myReaction }: MessageMiniReactionBarProps) {
  return (
    <div
      role="menu"
      aria-label="React to message"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 8px',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-pill)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
      }}
    >
      {MESSAGE_REACTIONS.map((r) => {
        const active = myReaction === r.key
        return (
          <button
            key={r.key}
            type="button"
            role="menuitem"
            aria-label={r.label}
            onClick={() => onSelect(r.key as MessageReactionKey)}
            style={{
              background: active ? 'var(--uc-indigo-bg)' : 'none',
              border: active ? '0.5px solid var(--uc-indigo)' : 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              padding: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 150ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.3)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
            title={r.label}
          >
            <TwemojiIcon codepoint={r.codepoint} size={20} label={r.label} />
          </button>
        )
      })}
    </div>
  )
}
