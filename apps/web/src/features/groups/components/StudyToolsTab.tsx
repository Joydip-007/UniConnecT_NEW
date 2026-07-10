import { useState } from 'react'
import type { GroupType, MemberRole } from '../types'
import { AcademicOnlyNotice } from './StudyToolsPrimitives'
import { StudyDecksPanel } from './StudyDecksPanel'
import { StudyNotesPanel } from './StudyNotesPanel'
import { StudySessionsTab } from './StudySessionsTab'
import { controlButton } from './StudyToolsStyles'

type StudyMode = 'sessions' | 'decks' | 'notes'

export function StudyToolsTab({ groupId, currentUserId, userRole, groupType }: {
  groupId: string
  currentUserId?: string
  userRole: MemberRole | null
  groupType?: GroupType
}) {
  const [mode, setMode] = useState<StudyMode>('sessions')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="tablist" aria-label="Study tools" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['sessions', 'decks', 'notes'] as const).map((item) => (
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
            {item === 'sessions' ? 'Sessions' : item === 'decks' ? 'Decks' : 'Notes'}
          </button>
        ))}
      </div>
      {mode === 'sessions' && <StudySessionsTab groupId={groupId} currentUserId={currentUserId} showCreateAction />}
      {mode === 'decks' && (
        groupType === 'academic' ? (
          <StudyDecksPanel groupId={groupId} currentUserId={currentUserId} userRole={userRole} />
        ) : (
          <AcademicOnlyNotice
            message="Flashcard decks are available in Academic Groups created by faculty."
            icon="🎓"
          />
        )
      )}
      {mode === 'notes' && <StudyNotesPanel groupId={groupId} currentUserId={currentUserId} userRole={userRole} />}
    </div>
  )
}
