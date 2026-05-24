import { useState, useRef, useEffect } from 'react'
import { Clock, Edit2, Plus, Trash2, X, Check, BookOpen } from 'lucide-react'
import {
  useSessionLog,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  type CreateSessionPayload,
} from '../hooks/useSessionLog'
import type { MentorshipSession } from '../types'
import { SessionRowSkeleton } from './Skeletons'

const KEYFRAMES = `
@keyframes uc-session-slide-in {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes uc-session-fade-out {
  from { opacity: 1; max-height: 200px; margin-bottom: 8px; }
  to   { opacity: 0; max-height: 0;    margin-bottom: 0;   }
}
`

let _sessionKeyframesInjected = false
function ensureSessionKeyframes() {
  if (_sessionKeyframesInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.setAttribute('data-uc', 'session-keyframes')
  el.textContent = KEYFRAMES
  document.head.appendChild(el)
  _sessionKeyframesInjected = true
}

const DURATIONS = [15, 30, 45, 60, 90, 120] as const

interface SessionLogPanelProps {
  requestId: string
  currentUserId: string
}

interface FormState {
  sessionDate: string
  durationMinutes: number
  topic: string
  notes: string
}

function emptyForm(): FormState {
  return {
    sessionDate: new Date().toISOString().slice(0, 10),
    durationMinutes: 60,
    topic: '',
    notes: '',
  }
}

export function SessionLogPanel({ requestId, currentUserId }: SessionLogPanelProps) {
  ensureSessionKeyframes()
  const { data: sessions = [], isLoading } = useSessionLog(requestId)
  const createMutation = useCreateSession(requestId)
  const updateMutation = useUpdateSession(requestId)
  const deleteMutation = useDeleteSession(requestId)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const topicRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showForm) topicRef.current?.focus()
  }, [showForm])

  function openAdd() {
    setForm(emptyForm())
    setShowForm(true)
    setEditingId(null)
  }

  function openEdit(s: MentorshipSession) {
    setEditingId(s.id)
    setEditForm({
      sessionDate: s.sessionDate,
      durationMinutes: s.durationMinutes,
      topic: s.topic,
      notes: s.notes ?? '',
    })
    setShowForm(false)
  }

  async function submitAdd() {
    if (!form.topic.trim()) return
    const payload: CreateSessionPayload = {
      sessionDate: form.sessionDate,
      durationMinutes: form.durationMinutes,
      topic: form.topic.trim(),
      notes: form.notes.trim() || null,
    }
    await createMutation.mutateAsync(payload)
    setShowForm(false)
    setForm(emptyForm())
  }

  async function submitEdit(sessionId: string) {
    if (!editForm.topic.trim()) return
    await updateMutation.mutateAsync({
      sessionId,
      sessionDate: editForm.sessionDate,
      durationMinutes: editForm.durationMinutes,
      topic: editForm.topic.trim(),
      notes: editForm.notes.trim() || null,
    })
    setEditingId(null)
  }

  async function handleDelete(sessionId: string) {
    setDeletingId(sessionId)
    try {
      await deleteMutation.mutateAsync(sessionId)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            Session log
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={openAdd}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--uc-indigo-xl)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 'var(--r-pill)',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--uc-indigo-bg)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <Plus size={13} strokeWidth={2} />
              Log session
            </button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <div
            style={{
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              animation: 'uc-session-slide-in 200ms ease-out',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={form.sessionDate}
                  onChange={(e) => setForm((f) => ({ ...f, sessionDate: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Duration</label>
                <select
                  value={form.durationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
                  style={inputStyle}
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>{d} min</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Topic</label>
              <input
                ref={topicRef}
                type="text"
                placeholder="What did you discuss?"
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Notes <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span></label>
              <textarea
                placeholder="Any takeaways or next steps…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => void submitAdd()}
                disabled={!form.topic.trim() || createMutation.isPending}
                style={primaryBtnStyle(!form.topic.trim() || createMutation.isPending)}
              >
                <Check size={13} strokeWidth={2} />
                {createMutation.isPending ? 'Saving…' : 'Save session'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={ghostBtnStyle}
              >
                <X size={13} strokeWidth={2} />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Session list */}
        {isLoading && <SessionRowSkeleton />}

        {!isLoading && sessions.length === 0 && !showForm && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '24px 0',
              color: 'var(--text-tertiary)',
            }}
          >
            <BookOpen size={28} strokeWidth={1.2} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 400 }}>No sessions logged yet</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 400 }}>Add your first one above</p>
          </div>
        )}

        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            isOwner={session.createdBy === currentUserId}
            isDeleting={deletingId === session.id}
            isEditing={editingId === session.id}
            editForm={editForm}
            setEditForm={setEditForm}
            onEdit={() => openEdit(session)}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={() => void submitEdit(session.id)}
            onDelete={() => void handleDelete(session.id)}
            isSavingEdit={updateMutation.isPending}
          />
        ))}
    </div>
  )
}

// ── SessionRow ────────────────────────────────────────────────────────────────

interface SessionRowProps {
  session: MentorshipSession
  isOwner: boolean
  isDeleting: boolean
  isEditing: boolean
  editForm: FormState
  setEditForm: (f: FormState) => void
  onEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onDelete: () => void
  isSavingEdit: boolean
}

function SessionRow({
  session,
  isOwner,
  isDeleting,
  isEditing,
  editForm,
  setEditForm,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  isSavingEdit,
}: SessionRowProps) {
  const [hovered, setHovered] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (isEditing) {
    return (
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-md)',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          animation: 'uc-session-slide-in 180ms ease-out',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={editForm.sessionDate}
              onChange={(e) => setEditForm({ ...editForm, sessionDate: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Duration</label>
            <select
              value={editForm.durationMinutes}
              onChange={(e) => setEditForm({ ...editForm, durationMinutes: Number(e.target.value) })}
              style={inputStyle}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Topic</label>
          <input
            type="text"
            value={editForm.topic}
            onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Notes <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span></label>
          <textarea
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onSaveEdit}
            disabled={!editForm.topic.trim() || isSavingEdit}
            style={primaryBtnStyle(!editForm.topic.trim() || isSavingEdit)}
          >
            <Check size={13} strokeWidth={2} />
            {isSavingEdit ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={onCancelEdit} style={ghostBtnStyle}>
            <X size={13} strokeWidth={2} />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 12,
        padding: '10px 12px',
        background: 'var(--surface-raised)',
        borderRadius: 'var(--r-md)',
        border: '0.5px solid var(--border-default)',
        animation: 'uc-session-slide-in 220ms ease-out',
        opacity: isDeleting ? 0.4 : 1,
        transition: 'opacity 200ms',
      }}
    >
      {/* Date + duration column */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          minWidth: 52,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--uc-indigo-xl)',
            background: 'var(--uc-indigo-bg)',
            padding: '2px 6px',
            borderRadius: 'var(--r-pill)',
            whiteSpace: 'nowrap',
          }}
        >
          {formatSessionDate(session.sessionDate)}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 11,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
          }}
        >
          <Clock size={10} strokeWidth={2} />
          {session.durationMinutes}m
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          {session.topic}
        </p>
        {session.notes && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {session.notes}
          </p>
        )}
      </div>

      {/* Owner actions — visible on hover */}
      {isOwner && (
        <>
        {confirmingDelete ? (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
              Delete?
            </p>
            <button
              type="button"
              onClick={() => { onDelete(); setConfirmingDelete(false) }}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '5px 12px',
                borderRadius: 'var(--r-pill)',
                border: '0.5px solid var(--uc-orange-bdr, var(--border-default))',
                background: 'var(--uc-orange-bg)',
                color: 'var(--uc-orange-l)',
                cursor: 'pointer',
              }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              style={{
                fontSize: 12,
                fontWeight: 400,
                padding: '5px 10px',
                borderRadius: 'var(--r-pill)',
                border: '0.5px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        ) : (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              gap: 4,
              opacity: hovered && !isDeleting ? 1 : 0,
              transition: 'opacity 150ms',
            }}
          >
            <button
              type="button"
              onClick={onEdit}
              title="Edit session"
              style={iconBtnStyle}
            >
              <Edit2 size={12} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={isDeleting}
              title="Delete session"
              style={{ ...iconBtnStyle, color: 'var(--uc-red)' }}
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>
          </div>
        )}
        </>
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontWeight: 400,
  padding: '7px 10px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms',
}

const iconBtnStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--r-pill)',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  transition: 'background 150ms, color 150ms',
}

const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  fontWeight: 500,
  padding: '6px 12px',
  borderRadius: 'var(--r-pill)',
  border: '0.5px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'background 150ms',
}

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 12px',
    borderRadius: 'var(--r-pill)',
    border: 'none',
    background: disabled ? 'var(--surface-raised)' : 'var(--uc-mint)',
    color: disabled ? 'var(--text-tertiary)' : 'var(--surface-page)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'background 150ms, opacity 150ms',
  }
}

function formatSessionDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  if (!year || !month || !day) return dateStr
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[Number(month) - 1]} ${Number(day)}`
}
