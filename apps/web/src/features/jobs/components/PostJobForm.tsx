import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { addDays, format, nextMonday } from 'date-fns'
import { AlertTriangle, CalendarClock, Send, X } from 'lucide-react'
import type { AttachmentInput } from '@uniconnect/shared'
import { JOB_DEPARTMENTS, JOB_MIN_CGPA_OPTIONS } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { Modal } from '@/components/Modal'
import { AttachmentPicker } from '@/components/AttachmentPicker'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useThemeStore } from '@/stores/themeStore'
import { formatWhen } from '../jobMeta'
import type { Job } from './JobCard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
  /** Called after a successful post/schedule so the page can switch to My postings. */
  onPosted?: () => void
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
  minCgpa: string
  publish: 'now' | 'schedule'
  schedDate: string
  schedTime: string
  quick: 'tomorrow' | 'monday' | 'custom' | null
}

const EMPTY_FORM: JobForm = {
  title: '',
  company: '',
  location: '',
  type: '',
  description: '',
  salaryRange: '',
  applicationUrl: '',
  deadline: '',
  minCgpa: '0',
  publish: 'now',
  schedDate: '',
  schedTime: '09:00',
  quick: null,
}

const ROLE_LABEL: Record<string, string> = { alumni: 'Alumni', faculty: 'Faculty', admin: 'Admin', student: 'Student' }

/** Graduation batches on offer: last year through three years out. */
function batchOptions(): string[] {
  const y = new Date().getFullYear()
  return [y - 1, y, y + 1, y + 2].map(String)
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  padding: '9px 12px',
  fontSize: 13,
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 150ms',
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

function Label({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
      {children}
      {!required && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>(optional)</span>}
    </label>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: '6px 12px',
        borderRadius: 'var(--r-pill)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        background: active ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
        border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
        color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  )
}

const sectionBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 14,
  borderRadius: 'var(--r-md)',
  border: '0.5px solid var(--border-default)',
}

const subLabel: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-label)' }

// ── RequirementsInput ─────────────────────────────────────────────────────────

function RequirementsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
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

  return (
    <label
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '8px 10px',
        minHeight: 42,
        boxSizing: 'border-box',
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        cursor: 'text',
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 6px 2px 8px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--role-alumni-bg)',
            border: '0.5px solid var(--role-alumni-bdr)',
            color: 'var(--role-alumni-text)',
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
            style={{ background: 'none', border: 'none', padding: 0, lineHeight: 0, cursor: 'pointer', color: 'var(--text-tertiary)' }}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        id="pjf-reqs"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) {
            addTag(inputValue)
            setInputValue('')
          }
        }}
        placeholder={tags.length === 0 ? 'React.js, Node.js, PostgreSQL…' : ''}
        style={{ flex: '1 1 120px', minWidth: 80, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', padding: '1px 2px' }}
      />
    </label>
  )
}

// ── PostJobForm ───────────────────────────────────────────────────────────────

export function PostJobForm({ onClose, onPosted }: Props) {
  const user = useAuthStore((s) => s.user)
  const showToast = useToastStore((s) => s.show)
  const theme = useThemeStore((s) => s.resolved)
  const [form, setForm] = useState<JobForm>(EMPTY_FORM)
  const [requirements, setRequirements] = useState<string[]>([])
  const [depts, setDepts] = useState<string[]>([])
  const [batches, setBatches] = useState<string[]>([])
  const [attachments, setAttachments] = useState<AttachmentInput[]>([])
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)

  function set<K extends keyof JobForm>(field: K, value: JobForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }
  const toggle = (list: string[], setList: (v: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const today = format(new Date(), 'yyyy-MM-dd')
  const valid = !!(form.title.trim() && form.company.trim() && form.location.trim() && form.type && form.description.trim() && form.deadline)

  // ── Schedule validation ────────────────────────────────────────────────────
  const isSched = form.publish === 'schedule'
  let schedOk = true
  let schedText = ''
  let schedAt: Date | null = null
  if (isSched) {
    if (!form.schedDate || !form.schedTime) {
      schedOk = false
      schedText = 'Pick a date and time to publish.'
    } else {
      schedAt = new Date(`${form.schedDate}T${form.schedTime}:00`)
      const dl = form.deadline ? new Date(`${form.deadline}T23:59:00`) : null
      if (schedAt.getTime() <= Date.now()) {
        schedOk = false
        schedText = 'That time has already passed. Pick a later time.'
      } else if (dl && schedAt >= dl) {
        schedOk = false
        schedText = 'The post would go live after the application deadline. Move one of them.'
      } else {
        schedText = `Goes live ${formatWhen(schedAt)}. It sits in My postings as Scheduled until then.`
      }
    }
  }
  const blocked = !valid || !schedOk

  const tomorrow = addDays(new Date(), 1)
  const monday = nextMonday(new Date())
  const quickDefs = [
    { key: 'tomorrow' as const, label: 'Tomorrow, 9:00 AM', date: format(tomorrow, 'yyyy-MM-dd') },
    { key: 'monday' as const, label: `${format(monday, 'EEE, MMM d')}, 9:00 AM`, date: format(monday, 'yyyy-MM-dd') },
    { key: 'custom' as const, label: 'Custom', date: null },
  ]

  const postMutation = useMutation({
    mutationFn: (isPublished: boolean) =>
      api
        .post<{ data: Job }>('/jobs', {
          title: form.title.trim(),
          company: form.company.trim(),
          location: form.location.trim(),
          type: form.type || undefined,
          description: form.description.trim(),
          requirements,
          isPublished,
          eligibleDepartments: depts,
          eligibleBatches: batches,
          minCgpa: Number(form.minCgpa) || null,
          ...(isPublished && isSched && schedAt && { publishAt: schedAt.toISOString() }),
          ...(attachments.length > 0 && { attachments }),
          ...(form.salaryRange.trim() && { salaryRange: form.salaryRange.trim() }),
          ...(form.applicationUrl.trim() && { applicationUrl: form.applicationUrl.trim() }),
          deadline: new Date(`${form.deadline}T23:59:00`).toISOString(),
        })
        .then((r) => r.data.data),
    onSuccess: (_data, isPublished) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      if (!isPublished) {
        queryClient.invalidateQueries({ queryKey: ['drafts', 'mine'] })
        showToast({ message: 'Saved to Drafts' })
      } else {
        showToast({ message: isSched && schedAt ? `Scheduled for ${formatWhen(schedAt)}` : 'Job posted. It is live in Browse.' })
        onPosted?.()
      }
      onClose()
    },
  })

  const busy = postMutation.isPending || attachmentsUploading
  const hint = !valid
    ? 'Title, company, location, type, description and deadline are required.'
    : isSched
      ? schedOk && schedAt
        ? `Publishes ${formatWhen(schedAt)}`
        : 'Fix the publish time.'
      : 'Goes live as soon as you post.'

  const footBtn: React.CSSProperties = {
    minHeight: 38,
    padding: '0 14px',
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 'var(--r-pill)',
    border: '0.5px solid var(--border-hover)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'inherit',
    cursor: 'pointer',
  }

  return (
    <Modal isOpen onClose={onClose} title="Post a job" frame="panel" sheet>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!blocked) postMutation.mutate(true)
        }}
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 16px', borderBottom: '0.5px solid var(--border-default)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Post a job</h2>
            {user && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                Posting as {user.profile.fullName} · {ROLE_LABEL[user.role] ?? user.role}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 'var(--r-pill)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="rail-scroll" style={{ overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="pjf-title" required>Job title</Label>
            <input id="pjf-title" type="text" required placeholder="Software Engineering Intern" value={form.title} onChange={(e) => set('title', e.target.value)} style={fieldStyle} onFocus={focusBorder} onBlur={blurBorder} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="pjf-company" required>Company</Label>
              <input id="pjf-company" type="text" required placeholder="Pathao Bangladesh" value={form.company} onChange={(e) => set('company', e.target.value)} style={fieldStyle} onFocus={focusBorder} onBlur={blurBorder} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="pjf-location" required>Location</Label>
              <input id="pjf-location" type="text" required placeholder="Remote" value={form.location} onChange={(e) => set('location', e.target.value)} style={fieldStyle} onFocus={focusBorder} onBlur={blurBorder} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="pjf-type" required>Job type</Label>
            <select id="pjf-type" required aria-label="Job type" value={form.type} onChange={(e) => set('type', e.target.value as JobForm['type'])} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focusBorder} onBlur={blurBorder}>
              <option value="" disabled>Select type…</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="internship">Internship</option>
              <option value="remote">Remote</option>
              <option value="contract">Contract</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Label htmlFor="pjf-desc" required>Description</Label>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{form.description.length} / 2000</span>
            </span>
            <textarea id="pjf-desc" required rows={4} maxLength={2000} placeholder="Describe the role, responsibilities, and what you're looking for…" value={form.description} onChange={(e) => set('description', e.target.value)} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }} onFocus={focusBorder} onBlur={blurBorder} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="pjf-reqs">Required skills</Label>
            <RequirementsInput tags={requirements} onChange={setRequirements} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Press Enter or comma to add each skill</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="pjf-salary">Salary range</Label>
              <input id="pjf-salary" type="text" placeholder="15,000–20,000 BDT/mo" value={form.salaryRange} onChange={(e) => set('salaryRange', e.target.value)} style={fieldStyle} onFocus={focusBorder} onBlur={blurBorder} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="pjf-deadline" required>Application deadline</Label>
              <input id="pjf-deadline" type="date" required min={today} value={form.deadline} onChange={(e) => set('deadline', e.target.value)} style={{ ...fieldStyle, colorScheme: theme }} onFocus={focusBorder} onBlur={blurBorder} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="pjf-url">External application URL</Label>
            <input id="pjf-url" type="url" placeholder="https://careers.company.com/apply/…" value={form.applicationUrl} onChange={(e) => set('applicationUrl', e.target.value)} style={fieldStyle} onFocus={focusBorder} onBlur={blurBorder} />
          </div>

          {/* Who can apply */}
          <div style={sectionBox}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Who can apply</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.5 }}>
                Students outside these see Not eligible. Leave empty to open it to everyone.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={subLabel}>Departments</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {JOB_DEPARTMENTS.map((d) => (
                  <Chip key={d} active={depts.includes(d)} onClick={() => toggle(depts, setDepts, d)}>{d}</Chip>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={subLabel}>Graduation batch</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {batchOptions().map((b) => (
                  <Chip key={b} active={batches.includes(b)} onClick={() => toggle(batches, setBatches, b)}>{b}</Chip>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...subLabel, flex: 1 }}>Minimum CGPA</span>
              <select aria-label="Minimum CGPA" value={form.minCgpa} onChange={(e) => set('minCgpa', e.target.value)} style={{ ...fieldStyle, width: 140, cursor: 'pointer' }} onFocus={focusBorder} onBlur={blurBorder}>
                <option value="0">No minimum</option>
                {JOB_MIN_CGPA_OPTIONS.map((c) => (
                  <option key={c} value={String(c)}>{c.toFixed(2)}</option>
                ))}
              </select>
            </label>
          </div>

          {/* When to publish */}
          <div style={sectionBox}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>When to publish</div>
              <div role="radiogroup" aria-label="When to publish" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)' }}>
                {([
                  { k: 'now' as const, label: 'Post now', Icon: Send },
                  { k: 'schedule' as const, label: 'Schedule', Icon: CalendarClock },
                ]).map(({ k, label, Icon }) => {
                  const on = form.publish === k
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() =>
                        k === 'schedule' && !form.schedDate
                          ? setForm((p) => ({ ...p, publish: k, schedDate: quickDefs[0].date!, schedTime: '09:00', quick: 'tomorrow' }))
                          : set('publish', k)
                      }
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 500, border: 'none', borderRadius: 'var(--r-pill)', fontFamily: 'inherit', cursor: 'pointer', background: on ? 'var(--surface-card)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            {isSched && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {quickDefs.map((q) => (
                    <Chip
                      key={q.key}
                      active={form.quick === q.key}
                      onClick={() => setForm((p) => (q.date ? { ...p, quick: q.key, schedDate: q.date, schedTime: '09:00' } : { ...p, quick: q.key }))}
                    >
                      {q.label}
                    </Chip>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={subLabel}>Date</span>
                    <input type="date" min={today} aria-label="Publish date" value={form.schedDate} onChange={(e) => setForm((p) => ({ ...p, schedDate: e.target.value, quick: 'custom' }))} style={{ ...fieldStyle, colorScheme: theme }} onFocus={focusBorder} onBlur={blurBorder} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={subLabel}>Time</span>
                    <input type="time" aria-label="Publish time" value={form.schedTime} onChange={(e) => setForm((p) => ({ ...p, schedTime: e.target.value, quick: 'custom' }))} style={{ ...fieldStyle, colorScheme: theme }} onFocus={focusBorder} onBlur={blurBorder} />
                  </label>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '9px 12px',
                    borderRadius: 'var(--r-md)',
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                    background: schedOk ? 'var(--uc-indigo-bg)' : 'var(--uc-amber-bg)',
                    border: `0.5px solid ${schedOk ? 'var(--uc-indigo-bdr)' : 'var(--uc-amber-bdr)'}`,
                  }}
                >
                  {schedOk ? (
                    <CalendarClock size={14} color="var(--uc-indigo-l)" style={{ marginTop: 2, flexShrink: 0 }} />
                  ) : (
                    <AlertTriangle size={14} color="var(--uc-amber-l)" style={{ marginTop: 2, flexShrink: 0 }} />
                  )}
                  <span>{schedText}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="pjf-attach">Attachments</Label>
            <AttachmentPicker value={attachments} onChange={setAttachments} onUploadingChange={setAttachmentsUploading} disabled={postMutation.isPending} />
          </div>

          {postMutation.isError && (
            <span role="alert" style={{ fontSize: 12, color: 'var(--uc-red)' }}>
              Could not post the job. Check the fields and try again.
            </span>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 24px', borderTop: '0.5px solid var(--border-default)', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: 12, lineHeight: 1.5, color: blocked ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>{hint}</span>
          <button type="button" onClick={onClose} style={footBtn}>
            Cancel
          </button>
          <button type="button" disabled={!valid || busy} onClick={() => postMutation.mutate(false)} style={{ ...footBtn, opacity: valid ? 1 : 0.45, cursor: valid ? 'pointer' : 'not-allowed' }}>
            Save as draft
          </button>
          <button
            type="submit"
            disabled={blocked || busy}
            style={{ ...footBtn, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', border: 'none', background: 'var(--uc-mint)', color: 'var(--on-accent)', opacity: blocked ? 0.45 : 1, cursor: blocked ? 'not-allowed' : 'pointer' }}
          >
            {isSched ? <CalendarClock size={14} /> : <Send size={14} />}
            {postMutation.isPending ? 'Posting…' : isSched ? 'Schedule post' : 'Post job'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
