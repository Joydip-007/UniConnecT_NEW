import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProfileEducation } from '@uniconnect/shared'
import { createEducation, deleteEducation, updateEducation } from '@/lib/api/users'
import { Modal } from '@/components/Modal'
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

function FieldRow({ label, optional, htmlFor, children }: { label: string; optional?: boolean; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
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
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit education' : 'Add education'} maxWidth={480}>
        <form
          id="edu-form"
          onSubmit={handleSubmit}
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 20px 4px' }}
        >
          <FieldRow label="Institution" htmlFor="edu-institution">
            <input id="edu-institution" type="text" value={institution} onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. United International University" required style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <FieldRow label="Degree" optional htmlFor="edu-degree">
            <input id="edu-degree" type="text" value={degree} onChange={(e) => setDegree(e.target.value)}
              placeholder="e.g. Bachelor of Science" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <FieldRow label="Field of study" optional htmlFor="edu-field">
            <input id="edu-field" type="text" value={fieldOfStudy} onChange={(e) => setFieldOfStudy(e.target.value)}
              placeholder="e.g. Computer Science and Engineering" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldRow label="Start year" htmlFor="edu-start-year">
              <input id="edu-start-year" type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)}
                min={1950} max={currentYear + 6} required style={inputBase} onFocus={onFocus} onBlur={onBlur} />
            </FieldRow>
            <FieldRow label="End year" optional htmlFor="edu-end-year">
              <input id="edu-end-year" type="number" value={current ? '' : endYear} onChange={(e) => setEndYear(e.target.value)}
                min={1950} max={currentYear + 6} disabled={current}
                style={{ ...inputBase, opacity: current ? 0.5 : 1 }} onFocus={onFocus} onBlur={onBlur} />
            </FieldRow>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)}
              style={{ accentColor: 'var(--uc-indigo)', width: 15, height: 15, cursor: 'pointer' }} />
            I currently study here
          </label>

          <FieldRow label="Grade / GPA" optional htmlFor="edu-grade">
            <input id="edu-grade" type="text" value={grade} onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g. 3.85 / 4.00" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <FieldRow label="Description" optional htmlFor="edu-description">
            <textarea id="edu-description" value={description} onChange={(e) => setDescription(e.target.value)}
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
    </Modal>
  )
}
