import React, { lazy, Suspense, useEffect, useRef } from 'react'
import { useThemeStore } from '@/stores/themeStore'

// Lazy-load emoji-mart — ~50 kB, only downloaded when picker first opens
const Picker = lazy(() =>
  import('@emoji-mart/react').then((m) => ({ default: m.default as React.ComponentType<Record<string, unknown>> })),
)

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const theme = useThemeStore((s) => s.resolved)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={containerRef} style={{ position: 'relative', zIndex: 60 }}>
      <Suspense fallback={
        <div style={{
          width: 352,
          height: 435,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}>
          Loading…
        </div>
      }>
        <Picker
          theme={theme === 'dark' ? 'dark' : 'light'}
          onEmojiSelect={(emoji: { native?: string }) => {
            if (emoji.native) onSelect(emoji.native)
          }}
          previewPosition="none"
          skinTonePosition="none"
          autoFocus
        />
      </Suspense>
    </div>
  )
}
