import { useState } from 'react'
import type { MemberRole } from '../types'
import { StudyDecksPanel } from './StudyDecksPanel'
import { StudySessionsTab } from './StudySessionsTab'
import { controlButton } from './StudyToolsStyles'

type StudyMode = 'sessions' | 'decks'

export function StudyToolsTab({ groupId, currentUserId, userRole }: {
  groupId: string
  currentUserId?: string
  userRole: MemberRole | null
}) {
  const [mode, setMode] = useState<StudyMode>('sessions')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="tablist" aria-label="Study tools" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['sessions', 'decks'] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => setMode(item)}
            className="press-feedback"
            style={{
              ...controlButton,
              background: mode === item ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
              color: mode === item ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
              minWidth: 96,
            }}
          >
            {item === 'sessions' ? 'Sessions' : 'Decks'}
          </button>
        ))}
      </div>
      {mode === 'sessions' && <StudySessionsTab groupId={groupId} currentUserId={currentUserId} userRole={userRole} />}
      {mode === 'decks' && (
        <StudyDecksPanel groupId={groupId} currentUserId={currentUserId} userRole={userRole} />
      )}
    </div>
  )
}
