import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '@/lib/axios'
import { Badge } from '@/components/Badge'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { queryClient } from '@/lib/queryClient'
import type { Job } from './JobCard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

interface JobForm {
  title: string
  company: string
  location: string
  type: Job['type'] | ''
  description: string
  salaryRange: string
  applicationUrl: string
  deadline: string
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
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
  transition: 'border-color 150ms',
}

function focusBorder(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}
function blurBorder(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
    >
      {children}
      {!required && (
        <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>
          (optional)
        </span>
      )}
    </label>
  )
}

// ── RequirementsInput ─────────────────────────────────────────────────────────

function RequirementsInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [inputValue, setInputValue] = useState('')

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,+$/, '').trim()
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
      setInputValue('')
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  function handleBlur() {
    if (inputValue.trim()) {
      addTag(inputValue)
      setInputValue('')
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '8px 10px',
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        cursor: 'text',
        transition: 'border-color 150ms',
        minHeight: 42,
      }}
      onClick={(e) => {
        const input = (e.currentTarget as HTMLElement).querySelector('input')
        input?.focus()
      }}
      onFocusCapture={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--uc-indigo-bdr)'
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'
        }
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Badge variant="alumni">{tag}</Badge>
          <button
            type="button"
            onClick={() => removeTag(tag)}
            aria-label={`Remove ${tag}`}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 0,
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={11} strokeWidth={2} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? 'React.js, Node.js, PostgreSQL…' : ''}
        style={{
          flex: '1 1 120px',
          minWidth: 80,
          background: 'none',
          border: 'none',
          outline: 'none',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          padding: '1px 2px',
        }}
      />
    </div>
  )
}

// ── PostJobForm ───────────────────────────────────────────────────────────────

const EMPTY_FORM: JobForm = {
  title: '',
  company: '',
  location: '',
  type: '',
  description: '',
  salaryRange: '',
  applicationUrl: '',
  deadline: '',
}

export function PostJobForm({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<JobForm>(EMPTY_FORM)
  const [requirements, setRequirements] = useState<string[]>([])

  function set(field: keyof JobForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const postMutation = useMutation({
    mutationFn: () =>
      api
        .post<{ data: Job }>('/jobs', {
          title: form.title,
          company: form.company,
          location: form.location,
          type: form.type || undefined,
          description: form.description,
          requirements,
          ...(form.salaryRange.trim() && { salaryRange: form.salaryRange.trim() }),
          ...(form.applicationUrl.trim() && { applicationUrl: form.applicationUrl.trim() }),
          ...(form.deadline && { deadline: new Date(form.deadline).toISOString() }),
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    postMutation.mutate()
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  const isValid = form.title && form.company && form.location && form.type && form.description

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 200,
        padding: '32px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            Post a job
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-tertiary)',
              lineHeight: 0,
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="pjf-title" required>Job title</Label>
            <input
              id="pjf-title"
              type="text"
              required
              placeholder="Software Engineering Intern"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              style={fieldStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Company + Location (side by side) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="pjf-company" required>Company</Label>
              <input
                id="pjf-company"
                type="text"
                required
                placeholder="Pathao Bangladesh"
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                style={fieldStyle}
                onFocus={focusBorder}
                onBlur={blurBorder}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="pjf-location" required>Location</Label>
              <input
                id="pjf-location"
                type="text"
                required
                placeholder="Remote"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                style={fieldStyle}
                onFocus={focusBorder}
                onBlur={blurBorder}
              />
            </div>
          </div>

          {/* Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="pjf-type" required>Job type</Label>
            <select
              id="pjf-type"
              required
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              style={{
                ...fieldStyle,
                appearance: 'none',
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(238,242,255,0.28)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: 32,
              }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            >
              <option value="" disabled>
                Select type…
              </option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="internship">Internship</option>
              <option value="remote">Remote</option>
              <option value="contract">Contract</option>
            </select>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="pjf-desc" required>Description</Label>
            <textarea
              id="pjf-desc"
              required
              rows={4}
              placeholder="Describe the role, responsibilities, and what you're looking for…"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Requirements (tag input) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="pjf-reqs">Required skills</Label>
            <RequirementsInput tags={requirements} onChange={setRequirements} />
            <span
              style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginTop: 2 }}
            >
              Press Enter or comma to add each skill
            </span>
          </div>

          {/* Salary + Deadline (side by side) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="pjf-salary">Salary range</Label>
              <input
                id="pjf-salary"
                type="text"
                placeholder="15,000–20,000 BDT/mo"
                value={form.salaryRange}
                onChange={(e) => set('salaryRange', e.target.value)}
                style={fieldStyle}
                onFocus={focusBorder}
                onBlur={blurBorder}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="pjf-deadline">Application deadline</Label>
              <input
                id="pjf-deadline"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={form.deadline}
                onChange={(e) => set('deadline', e.target.value)}
                style={{
                  ...fieldStyle,
                  colorScheme: 'dark',
                }}
                onFocus={focusBorder}
                onBlur={blurBorder}
              />
            </div>
          </div>

          {/* External application URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="pjf-url">External application URL</Label>
            <input
              id="pjf-url"
              type="url"
              placeholder="https://careers.company.com/apply/…"
              value={form.applicationUrl}
              onChange={(e) => set('applicationUrl', e.target.value)}
              style={fieldStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              paddingTop: 4,
              borderTop: '0.5px solid var(--border-default)',
            }}
          >
            <GhostBtn type="button" onClick={onClose}>
              Cancel
            </GhostBtn>
            <OrangeBtn type="submit" disabled={!isValid || postMutation.isPending}>
              {postMutation.isPending ? 'Posting…' : 'Post job'}
            </OrangeBtn>
          </div>
        </form>
      </div>
    </div>
  )
}
