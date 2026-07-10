import { useState } from 'react'
import { FileText, Paperclip, Pencil, Save, Trash2, X } from 'lucide-react'
import {
  useCreateSharedNote,
  useDeleteSharedNote,
  useSharedNoteUpload,
  useSharedNotes,
  useUpdateSharedNote,
} from '../hooks/useGroupExtended'
import type { Attachment, MemberRole, SharedNote } from '../types'
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
          groupId={groupId}
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
              {note.attachments?.length > 0 && (
                <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {note.attachments.map((attachment) => (
                    <li key={attachment.url}>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--uc-indigo)', textDecoration: 'none' }}
                      >
                        <Paperclip size={12} strokeWidth={1.7} />
                        {attachment.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
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

function NoteForm({ groupId, initial, isPending, onCancel, onSubmit }: {
  groupId: string
  initial: SharedNote | null
  isPending: boolean
  onCancel: () => void
  onSubmit: (input: { title: string; body: string; attachments: Attachment[] }) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [attachments, setAttachments] = useState<Attachment[]>(initial?.attachments ?? [])
  const uploadAttachment = useSharedNoteUpload(groupId)

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const attachment = await uploadAttachment.mutateAsync(file)
    setAttachments((prev) => [...prev, attachment])
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit({ title, body, attachments }) }} style={{ padding: 12, display: 'grid', gap: 8, borderTop: '0.5px solid var(--border-default)' }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" required maxLength={160} style={fieldStyle} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Note" required rows={4} maxLength={10000} style={{ ...fieldStyle, resize: 'vertical' }} />
      <div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <Paperclip size={14} strokeWidth={1.7} />
          {uploadAttachment.isPending ? 'Uploading...' : 'Attach file'}
          <input
            aria-label="Attach file"
            type="file"
            onChange={(e) => { void handleFileSelect(e) }}
            disabled={uploadAttachment.isPending}
            style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
          />
        </label>
        {uploadAttachment.isError && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--uc-red)' }}>
            {uploadAttachment.error instanceof Error ? uploadAttachment.error.message : 'Upload failed'}
          </p>
        )}
      </div>
      {attachments.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {attachments.map((attachment, index) => (
            <li
              key={`${attachment.url}-${index}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-default)', background: 'var(--surface-raised)', fontSize: 12, color: 'var(--text-secondary)' }}
            >
              <span>{attachment.name}</span>
              <button
                type="button"
                aria-label={`Remove ${attachment.name}`}
                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onCancel} style={controlButton}><X size={14} />Cancel</button>
        <button type="submit" disabled={isPending} style={{ ...controlButton, background: 'var(--uc-indigo)', color: 'var(--on-accent)', border: 'none' }}><Save size={14} />{initial ? 'Save' : 'Create'}</button>
      </div>
    </form>
  )
}
