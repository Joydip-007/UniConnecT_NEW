import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import type { ProfileExperience } from '@uniconnect/shared'
import { createExperience, deleteExperience, updateExperience } from '@/lib/api/users'
import { GhostBtn, PrimaryBtn } from '@/components/Button'

// ── Shared field styles ────────────────────────────────────────────────────────

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

function FieldRow({
  label,
  optional,
  children,
}: {
  label: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
        {label}
        {optional && (
          <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>
            (optional)
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

// ── toDateInput / fromDateInput ────────────────────────────────────────────────

/** Convert a Date | string | null to the YYYY-MM-DD string an <input type="date"> expects */
function toDateInput(v: string | Date | null | undefined): string {
  if (!v) return ''
  const d = typeof v === 'string' ? new Date(v) : v
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  entry?: ProfileExperience | null // null/undefined = add mode
  onClose: () => void
}

// ── ExperienceModal ────────────────────────────────────────────────────────────

export function ExperienceModal({ userId, entry, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const isEdit = !!entry

  const [title, setTitle] = useState(entry?.title ?? '')
  const [company, setCompany] = useState(entry?.company ?? '')
  const [location, setLocation] = useState(entry?.location ?? '')
  const [startDate, setStartDate] = useState(toDateInput(entry?.startDate))
  const [endDate, setEndDate] = useState(toDateInput(entry?.endDate))
  const [current, setCurrent] = useState(!entry?.endDate && !!entry)
  const [description, setDescription] = useState(entry?.description ?? '')

  // close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['profile', 'experience', userId] })

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        company: company.trim(),
        location: location.trim() || null,
        startDate,
        endDate: current ? null : endDate || null,
        description: description.trim() || null,
      }
      return isEdit
        ? updateExperience(entry!.id, payload)
        : createExperience(payload)
    },
    onSuccess: () => { invalidate(); onClose() },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteExperience(entry!.id),
    onSuccess: () => { invalidate(); onClose() },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !company.trim() || !startDate) return
    saveMutation.mutate()
  }

  const busy = saveMutation.isPending || deleteMutation.isPending

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 210,
        padding: '24px 16px',
      }}
      role="dialog"
      aria-modal
      aria-labelledby="exp-modal-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: 'calc(100dvh - 48px)',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 14px',
            borderBottom: '0.5px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          <h2 id="exp-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit experience' : 'Add experience'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', lineHeight: 0 }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <form
          id="exp-form"
          onSubmit={handleSubmit}
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 20px 4px' }}
        >
          <FieldRow label="Title">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Software Engineer" required style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <FieldRow label="Company">
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Google" required style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <FieldRow label="Location" optional>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Dhaka, Bangladesh" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldRow label="Start date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                required style={inputBase} onFocus={onFocus} onBlur={onBlur} />
            </FieldRow>

            <FieldRow label="End date" optional>
              <input type="date" value={current ? '' : endDate} onChange={(e) => setEndDate(e.target.value)}
                disabled={current} style={{ ...inputBase, opacity: current ? 0.5 : 1 }} onFocus={onFocus} onBlur={onBlur} />
            </FieldRow>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={current}
              onChange={(e) => setCurrent(e.target.checked)}
              style={{ accentColor: 'var(--uc-indigo)', width: 15, height: 15, cursor: 'pointer' }}
            />
            I currently work here
          </label>

          <FieldRow label="Description" optional>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your role and key achievements…"
              rows={4}
              maxLength={1000}
              style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6, minHeight: 88 }}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </FieldRow>

          <div style={{ height: 4, flexShrink: 0 }} />
        </form>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '14px 20px',
            borderTop: '0.5px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            {isEdit && (
              <button
                type="button"
                onClick={() => { if (!busy) deleteMutation.mutate() }}
                disabled={busy}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: busy ? 'default' : 'pointer',
                  padding: '6px 0',
                  fontSize: 13,
                  fontWeight: 400,
                  color: 'var(--uc-red)',
                  fontFamily: 'inherit',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete experience'}
              </button>
            )}
            {saveMutation.isError && (
              <span style={{ fontSize: 12, color: 'var(--uc-red)' }}>Failed to save — try again</span>
            )}
          </div>
          <GhostBtn type="button" onClick={onClose} disabled={busy}>Cancel</GhostBtn>
          <PrimaryBtn
            type="submit"
            form="exp-form"
            disabled={!title.trim() || !company.trim() || !startDate || busy}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  )
}
