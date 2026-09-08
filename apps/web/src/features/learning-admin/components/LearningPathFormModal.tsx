import { useEffect, useRef, useState } from 'react'
import type { AdminLearningPath } from '@uniconnect/shared'
import { PrimaryBtn, GhostBtn } from '@/components/Button'
import { useCreateLearningPath, useUpdateLearningPath } from '../hooks/useLearningAdmin'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-page)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  padding: '9px 12px',
  color: 'var(--text-primary)',
  fontSize: 14,
}
const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }

interface Props {
  mode: 'create' | 'edit'
  path: AdminLearningPath | null
  open: boolean
  onClose: () => void
}

export function LearningPathFormModal({ mode, path, open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const createPath = useCreateLearningPath()
  const updatePath = useUpdateLearningPath()
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [category, setCategory] = useState('career')
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [estimatedDays, setEstimatedDays] = useState(7)
  const [firstUnitTitle, setFirstUnitTitle] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // jsdom does not implement HTMLDialogElement.prototype.showModal/close, so
    // feature-detect and fall back to toggling the `open` attribute directly —
    // functionally equivalent for our purposes and crash-free under vitest.
    if (open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  useEffect(() => {
    if (mode === 'edit' && path) {
      setTitle(path.title)
      setDepartment(path.department ?? '')
      setCategory(path.category)
      setDifficulty(path.difficulty)
      setEstimatedDays(path.estimatedDays)
    } else if (mode === 'create') {
      setTitle('')
      setDepartment('')
      setCategory('career')
      setDifficulty('beginner')
      setEstimatedDays(7)
      setFirstUnitTitle('')
    }
    setMessage(null)
  }, [mode, path, open])

  function submit() {
    if (mode === 'create') {
      createPath.mutate(
        {
          title,
          department: department || null,
          category,
          difficulty,
          estimatedDays,
          units: [{ title: firstUnitTitle, type: 'read', content: { body: '' } }],
        },
        { onSuccess: () => setMessage('Path created.') },
      )
    } else if (path) {
      updatePath.mutate(
        { pathId: path.id, patch: { title, department: department || null, category, difficulty, estimatedDays } },
        { onSuccess: () => setMessage('Saved.') },
      )
    }
  }

  const pending = createPath.isPending || updatePath.isPending
  const canSubmit = title.trim().length > 0 && (mode === 'edit' || firstUnitTitle.trim().length > 0)

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      style={{
        border: 'none', borderRadius: 'var(--r-lg)', padding: 0, background: 'var(--surface-card)',
        maxWidth: 480, width: '100%',
      }}
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: 'var(--text-primary)' }}>
          {mode === 'create' ? 'New learning path' : 'Edit path'}
        </h2>

        <div>
          <label htmlFor="path-title" style={labelStyle}>Title</label>
          <input id="path-title" style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label htmlFor="path-department" style={labelStyle}>Department</label>
          <input id="path-department" style={inputStyle} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. CSE" />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="path-category" style={labelStyle}>Category</label>
            <input id="path-category" style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="path-difficulty" style={labelStyle}>Level</label>
            <select id="path-difficulty" style={inputStyle} value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="path-days" style={labelStyle}>Estimated days</label>
          <input id="path-days" type="number" style={inputStyle} value={estimatedDays} onChange={(e) => setEstimatedDays(Number(e.target.value))} />
        </div>

        {mode === 'create' && (
          <div>
            <label htmlFor="path-first-unit" style={labelStyle}>First unit title</label>
            <input id="path-first-unit" style={inputStyle} value={firstUnitTitle} onChange={(e) => setFirstUnitTitle(e.target.value)} placeholder="e.g. Getting started" />
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
              Add more units afterward from the path&apos;s Manage screen.
            </p>
          </div>
        )}

        {message && <span style={{ fontSize: 13, color: 'var(--uc-mint)' }}>{message}</span>}
        {(createPath.isError || updatePath.isError) && (
          <span style={{ fontSize: 13, color: 'var(--uc-red)' }}>Something went wrong. Try again.</span>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={!canSubmit || pending}>
            {pending ? 'Saving…' : mode === 'create' ? 'Create path' : 'Save changes'}
          </PrimaryBtn>
        </div>
      </div>
    </dialog>
  )
}
