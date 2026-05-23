import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '@/lib/axios'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { queryClient } from '@/lib/queryClient'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

interface NewsForm {
  title: string
  body: string
  category: string
  coverUrl: string
  isPublished: boolean
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

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(238,242,255,0.28)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")"

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
      {!required && (
        <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>(optional)</span>
      )}
    </label>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['academic', 'events', 'campus', 'research', 'announcement', 'other'] as const
type NewsCategory = (typeof CATEGORIES)[number]

const EMPTY: NewsForm = {
  title: '',
  body: '',
  category: '',
  coverUrl: '',
  isPublished: true,
}

// ── CreateNewsForm ─────────────────────────────────────────────────────────────

export function CreateNewsForm({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<NewsForm>(EMPTY)

  function set<K extends keyof NewsForm>(field: K, value: NewsForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/news', {
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        ...(form.coverUrl.trim() && { cover_url: form.coverUrl.trim() }),
        is_published: form.isPublished,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] })
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate()
  }

  const isValid = !!form.title.trim() && !!form.body.trim() && !!form.category

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
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
          maxWidth: 580,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
            Write news article
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="cnf-title" required>Headline</Label>
            <input
              id="cnf-title"
              type="text"
              required
              placeholder="University hosts annual career fair…"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              style={fieldStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="cnf-cat" required>Category</Label>
            <select
              id="cnf-cat"
              required
              value={form.category}
              onChange={(e) => set('category', e.target.value as NewsCategory | '')}
              style={{
                ...fieldStyle,
                appearance: 'none',
                backgroundImage: SELECT_CHEVRON,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: 32,
                colorScheme: 'dark',
              }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            >
              <option value="" disabled>Select category…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="cnf-body" required>Article body</Label>
            <textarea
              id="cnf-body"
              required
              rows={8}
              placeholder="Write the full article content here…"
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Cover URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="cnf-cover">Cover image URL</Label>
            <input
              id="cnf-cover"
              type="url"
              placeholder="https://…"
              value={form.coverUrl}
              onChange={(e) => set('coverUrl', e.target.value)}
              style={fieldStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Publish toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              padding: '10px 12px',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => set('isPublished', e.target.checked)}
              style={{ width: 14, height: 14, accentColor: 'var(--uc-indigo)', cursor: 'pointer' }}
            />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 400, color: 'var(--text-primary)' }}>
              Publish immediately
            </span>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {form.isPublished ? 'Visible to all members' : 'Save as draft'}
            </span>
          </label>

          {/* Server error */}
          {createMutation.isError && (
            <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--uc-red)' }}>
              Something went wrong. Please try again.
            </p>
          )}

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
            <OrangeBtn
              type="submit"
              disabled={!isValid || createMutation.isPending}
            >
              {createMutation.isPending ? 'Posting…' : (form.isPublished ? 'Publish article' : 'Save draft')}
            </OrangeBtn>
          </div>
        </form>
      </div>
    </div>
  )
}
