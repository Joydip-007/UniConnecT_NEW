import { useState } from 'react'
import { FileText, Pencil, Save, Trash2, X } from 'lucide-react'
import {
  useCreateSharedNote,
  useDeleteSharedNote,
  useSharedNotes,
  useUpdateSharedNote,
} from '../hooks/useGroupExtended'
import type { MemberRole, SharedNote } from '../types'
import {
  EmptyState,
  ListSkeleton,
  PanelHeader,
} from './StudyToolsPrimitives'
import {
  controlButton,
  fieldStyle,
  formatDisplayDate,
  iconButton,
  listSurface,
  shortPreview,
} from './StudyToolsStyles'

export function StudyNotesPanel({ groupId, currentUserId, userRole }: {
  groupId: string
  currentUserId?: string
  userRole: MemberRole | null
}) {
  const { data, isLoading } = useSharedNotes(groupId)
  const createNote = useCreateSharedNote(groupId)
  const updateNote = useUpdateSharedNote(groupId)
  const deleteNote = useDeleteSharedNote(groupId)
  const [editing, setEditing] = useState<SharedNote | null>(null)
  const [showNewNote, setShowNewNote] = useState(false)
  const notes = data?.items ?? []
  const canManageAll = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator'

  return (
    <section style={listSurface}>
      <PanelHeader title="Notes" icon={<FileText size={16} strokeWidth={1.7} />} actionLabel="New note" onAction={() => { setEditing(null); setShowNewNote(true) }} />
      {(showNewNote || editing) && (
        <NoteForm
          initial={editing}
          isPending={createNote.isPending || updateNote.isPending}
          onCancel={() => { setShowNewNote(false); setEditing(null) }}
          onSubmit={(input) => {
            if (editing) updateNote.mutate({ noteId: editing.id, input }, { onSuccess: () => setEditing(null) })
            else createNote.mutate(input, { onSuccess: () => setShowNewNote(false) })
          }}
        />
      )}
      {isLoading ? <ListSkeleton rows={3} /> : notes.length === 0 ? (
        <EmptyState title="No shared notes yet" actionLabel="New note" onAction={() => setShowNewNote(true)} />
      ) : notes.map((note) => {
        const canEdit = canManageAll || note.createdBy === currentUserId
        const author = note.creator?.fullName ?? 'Former member'
        return (
          <article key={note.id} style={{ padding: '12px 14px', borderTop: '0.5px solid var(--border-default)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{note.title}</p>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{author} · {formatDisplayDate(note.updatedAt)}</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{shortPreview(note.body)}</p>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" aria-label={`Edit ${note.title}`} onClick={() => { setShowNewNote(false); setEditing(note) }} style={iconButton}><Pencil size={15} /></button>
                <button type="button" aria-label={`Delete ${note.title}`} onClick={() => deleteNote.mutate(note.id)} style={iconButton}><Trash2 size={15} /></button>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}

function NoteForm({ initial, isPending, onCancel, onSubmit }: {
  initial: SharedNote | null
  isPending: boolean
  onCancel: () => void
  onSubmit: (input: { title: string; body: string }) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit({ title, body }) }} style={{ padding: 12, display: 'grid', gap: 8, borderTop: '0.5px solid var(--border-default)' }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" required style={fieldStyle} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Note" required rows={4} style={{ ...fieldStyle, resize: 'vertical' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onCancel} style={controlButton}><X size={14} />Cancel</button>
        <button type="submit" disabled={isPending} style={{ ...controlButton, background: 'var(--uc-indigo)', color: 'var(--on-accent)', border: 'none' }}><Save size={14} />{initial ? 'Save' : 'Create'}</button>
      </div>
    </form>
  )
}
