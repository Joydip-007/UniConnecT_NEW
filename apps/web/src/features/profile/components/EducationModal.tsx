import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import type { ProfileEducation } from '@uniconnect/shared'
import { createEducation, deleteEducation, updateEducation } from '@/lib/api/users'
import { GhostBtn, PrimaryBtn } from '@/components/Button'

const inputBase: React.CSSProperties = {
  padding: '9px 12px',
  fontSize: 13,
  fontWeight: 400,
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color 150ms',
}

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

function FieldRow({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
        {label}
        {optional && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>(optional)</span>}
      </label>
      {children}
    </div>
  )
}

const currentYear = new Date().getFullYear()

interface Props {
  userId: string
  entry?: ProfileEducation | null
  onClose: () => void
}

export function EducationModal({ userId, entry, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const isEdit = !!entry

  const [institution, setInstitution] = useState(entry?.institution ?? '')
  const [degree, setDegree] = useState(entry?.degree ?? '')
  const [fieldOfStudy, setFieldOfStudy] = useState(entry?.fieldOfStudy ?? '')
  const [startYear, setStartYear] = useState(String(entry?.startYear ?? currentYear))
  const [endYear, setEndYear] = useState(entry?.endYear ? String(entry.endYear) : '')
  const [current, setCurrent] = useState(!entry?.endYear && !!entry)
  const [grade, setGrade] = useState(entry?.grade ?? '')
  const [description, setDescription] = useState(entry?.description ?? '')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['profile', 'education', userId] })

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        institution: institution.trim(),
        degree: degree.trim() || null,
        fieldOfStudy: fieldOfStudy.trim() || null,
        startYear: parseInt(startYear, 10),
        endYear: current ? null : endYear ? parseInt(endYear, 10) : null,
        grade: grade.trim() || null,
        description: description.trim() || null,
      }
      return isEdit ? updateEducation(entry!.id, payload) : createEducation(payload)
    },
    onSuccess: () => { invalidate(); onClose() },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteEducation(entry!.id),
    onSuccess: () => { invalidate(); onClose() },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!institution.trim() || !startYear) return
    saveMutation.mutate()
  }

  const busy = saveMutation.isPending || deleteMutation.isPending

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'var(--overlay-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 210, padding: '24px 16px',
      }}
      role="dialog"
      aria-modal
      aria-labelledby="edu-modal-title"
    >
      <div
        style={{
          width: '100%', maxWidth: 480, maxHeight: 'calc(100dvh - 48px)',
          background: 'var(--surface-card)', border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '0.5px solid var(--border-default)', flexShrink: 0 }}>
          <h2 id="edu-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit education' : 'Add education'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', lineHeight: 0 }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form
          id="edu-form"
          onSubmit={handleSubmit}
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 20px 4px' }}
        >
          <FieldRow label="Institution">
            <input type="text" value={institution} onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. United International University" required style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <FieldRow label="Degree" optional>
            <input type="text" value={degree} onChange={(e) => setDegree(e.target.value)}
              placeholder="e.g. Bachelor of Science" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <FieldRow label="Field of study" optional>
            <input type="text" value={fieldOfStudy} onChange={(e) => setFieldOfStudy(e.target.value)}
              placeholder="e.g. Computer Science and Engineering" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldRow label="Start year">
              <input type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)}
                min={1950} max={currentYear + 6} required style={inputBase} onFocus={onFocus} onBlur={onBlur} />
            </FieldRow>
            <FieldRow label="End year" optional>
              <input type="number" value={current ? '' : endYear} onChange={(e) => setEndYear(e.target.value)}
                min={1950} max={currentYear + 6} disabled={current}
                style={{ ...inputBase, opacity: current ? 0.5 : 1 }} onFocus={onFocus} onBlur={onBlur} />
            </FieldRow>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)}
              style={{ accentColor: 'var(--uc-indigo)', width: 15, height: 15, cursor: 'pointer' }} />
            I currently study here
          </label>

          <FieldRow label="Grade / GPA" optional>
            <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g. 3.85 / 4.00" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <FieldRow label="Description" optional>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Activities, societies, achievements…" rows={3} maxLength={500}
              style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6, minHeight: 72 }}
              onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <div style={{ height: 4, flexShrink: 0 }} />
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 20px', borderTop: '0.5px solid var(--border-default)', flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            {isEdit && (
              <button type="button" onClick={() => { if (!busy) deleteMutation.mutate() }} disabled={busy}
                style={{ background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer', padding: '6px 0', fontSize: 13, fontWeight: 400, color: 'var(--uc-red)', fontFamily: 'inherit', opacity: busy ? 0.5 : 1 }}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete education'}
              </button>
            )}
            {saveMutation.isError && <span style={{ fontSize: 12, color: 'var(--uc-red)' }}>Failed to save — try again</span>}
          </div>
          <GhostBtn type="button" onClick={onClose} disabled={busy}>Cancel</GhostBtn>
          <PrimaryBtn type="submit" form="edu-form" disabled={!institution.trim() || !startYear || busy}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  )
}
