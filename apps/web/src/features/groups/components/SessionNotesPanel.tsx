import { useEffect, useRef, useState } from 'react'
import { NotebookPen, Pencil, X } from 'lucide-react'
import {
  useMySessionPrivateNotes,
  useSaveMySessionPrivateNotes,
  useSaveSessionCreatorNotes,
  useSessionCreatorNotes,
} from '../hooks/useGroupExtended'
import { controlButton, fieldStyle } from './StudyToolsStyles'

const SAVE_DEBOUNCE_MS = 1500

interface SessionNotesPanelProps {
  groupId: string
  sessionId: string
  isCreator: boolean
}

export function SessionNotesPanel({ groupId, sessionId, isCreator }: SessionNotesPanelProps) {
  const { data: creatorNotes } = useSessionCreatorNotes(groupId, sessionId)
  const saveCreatorNotes = useSaveSessionCreatorNotes(groupId, sessionId)
  const { data: privateNotes } = useMySessionPrivateNotes(groupId, sessionId)
  const savePrivateNotes = useSaveMySessionPrivateNotes(groupId, sessionId)

  const [editingCreator, setEditingCreator] = useState(false)
  const [creatorTitle, setCreatorTitle] = useState('')
  const [creatorBody, setCreatorBody] = useState('')
  const [privateBody, setPrivateBody] = useState('')
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setPrivateBody(privateNotes?.body ?? '')
  }, [privateNotes])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function startEditingCreator() {
    setCreatorTitle(creatorNotes?.title ?? '')
    setCreatorBody(creatorNotes?.body ?? '')
    setEditingCreator(true)
  }

  function handlePrivateChange(value: string) {
    setPrivateBody(value)
    setSaved(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void savePrivateNotes.mutateAsync({ body: value }).then(() => setSaved(true))
    }, SAVE_DEBOUNCE_MS)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
      <section style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-sm)', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h4 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            <NotebookPen size={15} strokeWidth={1.7} />
            {creatorNotes ? 'Creator notes' : 'Creator notes · empty'}
          </h4>
          {isCreator && !editingCreator && (
            <button type="button" onClick={startEditingCreator} style={{ ...controlButton, minHeight: 32, padding: '4px 10px', fontSize: 12 }}>
              <Pencil size={13} />
              {creatorNotes ? 'Edit' : 'Add notes'}
            </button>
          )}
        </div>

        {editingCreator ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              aria-label="Creator notes title"
              value={creatorTitle}
              onChange={(e) => setCreatorTitle(e.target.value)}
              placeholder="Title (optional)"
              style={fieldStyle}
            />
            <textarea
              aria-label="Creator notes body"
              value={creatorBody}
              onChange={(e) => setCreatorBody(e.target.value)}
              rows={4}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setEditingCreator(false)} style={{ ...controlButton, minHeight: 36, padding: '6px 12px', fontSize: 12 }}>
                <X size={13} />
                Cancel
              </button>
              <button
                type="button"
                disabled={saveCreatorNotes.isPending}
                onClick={() =>
                  void saveCreatorNotes
                    .mutateAsync({ title: creatorTitle, body: creatorBody })
                    .then(() => setEditingCreator(false))
                }
                style={{ ...controlButton, minHeight: 36, padding: '6px 12px', fontSize: 12, background: 'var(--uc-indigo)', color: 'var(--on-accent)', border: 'none' }}
              >
                Save
              </button>
            </div>
          </div>
        ) : creatorNotes ? (
          <div>
            {creatorNotes.title && (
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{creatorNotes.title}</p>
            )}
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{creatorNotes.body}</p>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No shared notes for this session yet.</p>
        )}
      </section>

      <section style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-sm)', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>My private notes</h4>
          {saved && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Saved</span>}
        </div>
        <textarea
          aria-label="My private notes"
          value={privateBody}
          onChange={(e) => handlePrivateChange(e.target.value)}
          rows={4}
          placeholder="Only visible to you"
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </section>
    </div>
  )
}
