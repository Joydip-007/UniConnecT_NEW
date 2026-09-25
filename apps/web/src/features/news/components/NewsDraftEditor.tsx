import { useState } from 'react'
import type { CSSProperties, FocusEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ArrowLeft, CheckCircle2, FileText, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { AttachmentInput } from '@uniconnect/shared'
import { AttachmentPicker } from '@/components/AttachmentPicker'
import { ImageUploadField } from '@/components/ImageUploadField'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSaveNews } from '../hooks/useNews'
import { NEWS_CATEGORIES } from '../types'
import type { NewsItem, NewsWritePayload } from '../types'
import { parseTags } from '../utils'

interface Props {
  /** The article being edited; absent when writing a new one. */
  initial?: NewsItem
  /** "Publishing as …" — the office the byline will name. */
  sourceLabel: string
}

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 150ms',
}

function focusBorder(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}
function blurBorder(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

/**
 * The article draft screen. Saving from here files a draft (or, for an article that
 * is already live, saves the edit in place); publishing happens on the article view,
 * where the author reads it as everyone else will before it goes out.
 */
export function NewsDraftEditor({ initial, sourceLabel }: Props) {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const save = useSaveNews()
  const isLive = Boolean(initial?.isPublished)

  const [category, setCategory] = useState(initial?.category ?? 'notice')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverUrl ?? null)
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [keyDate, setKeyDate] = useState(initial?.keyDate ?? '')
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [attachments, setAttachments] = useState<AttachmentInput[]>([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [dirty, setDirty] = useState(false)

  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setDirty(true)
  }

  // Imported articles can carry a category outside the four; keep it selectable.
  const categories = NEWS_CATEGORIES.includes(category as (typeof NEWS_CATEGORIES)[number])
    ? [...NEWS_CATEGORIES]
    : [...NEWS_CATEGORIES, category]

  const canSave = title.trim().length > 0 && body.trim().length > 0 && !uploading && !save.isPending
  const backTo = initial ? `/news/${initial.id}` : '/news'

  const statusLine = save.isPending
    ? 'Saving…'
    : dirty
      ? 'Unsaved changes'
      : initial
        ? `${isLive ? 'Published' : 'Saved as draft'} ${formatDistanceToNow(parseISO(initial.updatedAt), { addSuffix: true })}`
        : 'Not saved yet'

  function handleSave() {
    if (!canSave) return
    const payload: NewsWritePayload = {
      title: title.trim(),
      body: body.trim(),
      category,
      summary: summary.trim() || null,
      tags: parseTags(tags),
      key_date: keyDate || null,
      cover_url: coverUrl,
      // A new article is always filed as a draft; an edit keeps its published state.
      ...(!initial && { is_published: false }),
      ...(attachments.length > 0 && { attachments }),
      ...(removedAttachmentIds.length > 0 && { removedAttachmentIds }),
    }
    save.mutate(
      { id: initial?.id, payload },
      {
        onSuccess: (news) => {
          toast.success(isLive ? 'Changes saved' : 'Saved as draft')
          navigate(`/news/${news.id}`)
        },
        onError: () => toast.error('Could not save the article'),
      },
    )
  }

  function handleDiscard() {
    if (dirty && !window.confirm('Discard your changes to this article?')) return
    navigate(backTo)
  }

  const pill = (selected: boolean): CSSProperties => ({
    minHeight: isMobile ? 44 : undefined,
    padding: isMobile ? '0 14px' : '6px 14px',
    borderRadius: 'var(--r-pill)',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: selected ? 'var(--uc-orange-bg)' : 'var(--surface-raised)',
    border: `0.5px solid ${selected ? 'var(--uc-orange-bdr)' : 'var(--border-default)'}`,
    color: selected ? 'var(--uc-orange-l)' : 'var(--text-secondary)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={handleDiscard}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 14px', borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          News
        </button>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Publishing as {sourceLabel} · visible to everyone
        </span>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: 'var(--r-pill)',
            fontSize: 12,
            background: isLive ? 'var(--uc-mint-bg)' : 'var(--surface-raised)',
            border: `0.5px solid ${isLive ? 'var(--uc-mint-bdr)' : 'var(--border-default)'}`,
            color: isLive ? 'var(--uc-mint)' : 'var(--text-secondary)',
          }}
        >
          {isLive ? 'Published' : 'Draft'}
        </span>
      </div>

      <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: isMobile ? 14 : 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--uc-mint-bg)', border: '0.5px solid var(--uc-mint-bdr)', borderRadius: 'var(--r-md)' }}>
            <CheckCircle2 size={15} strokeWidth={1.5} color="var(--uc-mint)" />
            <span style={{ fontSize: 13, color: 'var(--uc-mint)' }}>This article is live — saved changes appear on the news feed straight away.</span>
          </div>
        )}

        <Field label="Category">
          <div role="radiogroup" aria-label="Category" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categories.map((value) => (
              <button key={value} type="button" role="radio" aria-checked={category === value} onClick={() => touch(setCategory)(value)} style={pill(category === value)}>
                {value}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Headline" htmlFor="news-headline">
          <input
            id="news-headline"
            value={title}
            maxLength={500}
            onChange={(e) => touch(setTitle)(e.target.value)}
            onFocus={focusBorder}
            onBlur={blurBorder}
            placeholder="Write a headline students will understand at a glance"
            style={{ ...fieldStyle, minHeight: 44 }}
          />
        </Field>

        <Field label="Cover image">
          <ImageUploadField value={coverUrl} onChange={touch(setCoverUrl)} folder="news" aspectRatio={isMobile ? '16 / 7' : '16 / 5'} />
        </Field>

        <Field label="Summary" htmlFor="news-summary">
          <textarea
            id="news-summary"
            value={summary}
            maxLength={400}
            rows={2}
            onChange={(e) => touch(setSummary)(e.target.value)}
            onFocus={focusBorder}
            onBlur={blurBorder}
            placeholder="One or two lines shown on the news list"
            style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }}
          />
        </Field>

        <Field label="Article body" htmlFor="news-body">
          <textarea
            id="news-body"
            value={body}
            onChange={(e) => touch(setBody)(e.target.value)}
            onFocus={focusBorder}
            onBlur={blurBorder}
            placeholder="Write the article. Keep the first paragraph answering what changed and by when."
            style={{ ...fieldStyle, minHeight: isMobile ? 200 : 260, resize: 'vertical' }}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '180px 1fr', gap: 12 }}>
          <Field label="Key date" htmlFor="news-key-date">
            <input
              id="news-key-date"
              type="date"
              value={keyDate}
              onChange={(e) => touch(setKeyDate)(e.target.value)}
              onFocus={focusBorder}
              onBlur={blurBorder}
              style={{ ...fieldStyle, minHeight: 44 }}
            />
          </Field>
          <Field label="Tags" htmlFor="news-tags">
            <input
              id="news-tags"
              value={tags}
              onChange={(e) => touch(setTags)(e.target.value)}
              onFocus={focusBorder}
              onBlur={blurBorder}
              placeholder="verification, add drop, shuttle"
              style={{ ...fieldStyle, minHeight: 44 }}
            />
          </Field>
        </div>

        <Field label="Attachments">
          <AttachmentPicker
            value={attachments}
            onChange={touch(setAttachments)}
            existing={initial?.attachments}
            removedIds={removedAttachmentIds}
            onRemovedIdsChange={touch(setRemovedAttachmentIds)}
            onUploadingChange={setUploading}
            disabled={save.isPending}
          />
        </Field>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: isMobile ? 72 : 0,
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{statusLine}</span>
        <button
          type="button"
          onClick={handleDiscard}
          style={{ minHeight: 38, padding: '0 16px', borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 38,
            padding: '0 20px',
            borderRadius: 'var(--r-pill)',
            border: 'none',
            background: 'var(--uc-orange)',
            color: 'var(--on-accent)',
            fontSize: 13,
            fontWeight: 500,
            cursor: canSave ? 'pointer' : 'not-allowed',
            opacity: canSave ? 1 : 0.5,
            fontFamily: 'inherit',
          }}
        >
          {isLive ? <Send size={14} strokeWidth={1.5} /> : <FileText size={14} strokeWidth={1.5} />}
          {save.isPending ? 'Saving…' : isLive ? 'Save changes' : 'Draft'}
        </button>
      </div>
    </div>
  )
}
