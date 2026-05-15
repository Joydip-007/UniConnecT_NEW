import React from 'react'

export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const splitRe = new RegExp(`(${escaped})`, 'gi')
  const matchRe = new RegExp(`^${escaped}$`, 'i')
  const parts = text.split(splitRe)
  return parts.map((part, i) =>
    matchRe.test(part) ? (
      <mark
        key={i}
        style={{
          background: 'var(--uc-indigo-bg)',
          color: 'var(--uc-indigo-xl)',
          borderRadius: 2,
          padding: '0 2px',
        }}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  )
}
