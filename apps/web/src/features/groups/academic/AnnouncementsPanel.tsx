import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { CalendarClock, Megaphone, Pin, Siren, X } from 'lucide-react'
import type { AttachmentInput } from '@uniconnect/shared'
import { AttachmentPicker } from '@/components/AttachmentPicker'
import { Toggle } from '@/features/settings/components/Toggle'
import { useAnnouncements, useCreateAnnouncement } from '../hooks/useGroupExtended'
import type { Announcement, AnnouncementKind, Attachment } from '../types'

interface Props {
  groupId: string
  isAdmin: boolean
}

const KIND: Record<AnnouncementKind, { label: string; Icon: typeof Megaphone; color: string; bg: string; bdr: string }> = {
  urgent: { label: 'Urgent', Icon: Siren, color: 'var(--uc-red)', bg: 'var(--uc-red-bg)', bdr: 'var(--uc-red-bdr)' },
  schedule: { label: 'Schedule', Icon: CalendarClock, color: 'var(--uc-amber-l)', bg: 'var(--uc-amber-bg)', bdr: 'var(--uc-amber-bdr)' },
  notice: { label: 'Notice', Icon: Megaphone, color: 'var(--uc-cyan)', bg: 'var(--uc-cyan-bg)', bdr: 'var(--uc-cyan-bdr)' },
}

const card = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
} as const

/** The picker stages `AttachmentInput` (feed shape); announcements store the note shape. */
function toNoteAttachment(a: AttachmentInput): Attachment {
  return { name: a.fileName, url: a.fileUrl, contentType: a.mimeType ?? 'application/octet-stream', size: a.sizeBytes ?? 0 }
}

export function AnnouncementsPanel({ groupId, isAdmin }: Props) {
  const { data: items = [], isLoading } = useAnnouncements(groupId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isAdmin && <Composer groupId={groupId} />}

      <div style={{ ...card, overflow: 'hidden' }}>
        {isLoading ? (
          <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>
            No announcements yet.
          </p>
        ) : (
          items.map((a, i) => <AnnouncementRow key={a.id} item={a} last={i === items.length - 1} />)
        )}
      </div>
    </div>
  )
}

function AnnouncementRow({ item, last }: { item: Announcement; last: boolean }) {
  const k = KIND[item.kind]
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        borderBottom: last ? 'none' : '0.5px solid var(--border-subtle)',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: k.bg,
          border: `0.5px solid ${k.bdr}`,
          color: k.color,
        }}
      >
        <k.Icon size={15} strokeWidth={1.5} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.title}</span>
          <span
            style={{
              fontSize: 11,
              padding: '1px 8px',
              borderRadius: 'var(--r-pill)',
              background: k.bg,
              border: `0.5px solid ${k.bdr}`,
              color: k.color,
            }}
          >
            {k.label}
          </span>
          {item.isPinned && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--uc-orange-l)' }}>
              <Pin size={11} strokeWidth={1.5} />
              pinned
            </span>
          )}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{item.body}</p>
        {item.attachments.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {item.attachments.map((f) => (
              <a
                key={f.url}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, color: 'var(--uc-indigo-l)', textDecoration: 'none' }}
              >
                {f.name}
              </a>
            ))}
          </div>
        )}
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
          Posted {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })} · {item.author.fullName}, course
          teacher
        </p>
      </div>
    </div>
  )
}

function Composer({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<AnnouncementKind>('notice')
  const [notify, setNotify] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentInput[]>([])
  const [uploading, setUploading] = useState(false)
  const create = useCreateAnnouncement(groupId)

  const reset = () => {
    setOpen(false)
    setTitle('')
    setBody('')
    setKind('notice')
    setNotify(false)
    setAttachments([])
  }

  const canPost = title.trim().length > 0 && body.trim().length > 0 && !uploading && !create.isPending

  const submit = () => {
    if (!canPost) return
    create.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        kind,
        notify_members: notify,
        attachments: attachments.map(toNoteAttachment),
      },
      { onSuccess: reset },
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          ...card,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          textAlign: 'left',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      >
        <Megaphone size={16} strokeWidth={1.5} style={{ color: 'var(--uc-indigo-l)', flexShrink: 0 }} />
        Post a notice — make-up CT, postponed class, anything urgent
      </button>
    )
  }

  return (
    <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>New announcement</span>
        <button
          type="button"
          onClick={reset}
          aria-label="Close composer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <input className="fld" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        className="fld"
        rows={3}
        placeholder="What do members need to know?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        style={{ resize: 'vertical' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-label)' }}>Kind</span>
        {(Object.keys(KIND) as AnnouncementKind[]).map((k) => {
          const active = k === kind
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => setKind(k)}
              style={{
                padding: '3px 10px',
                fontSize: 12,
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
              }}
            >
              {KIND[k].label}
            </button>
          )
        })}
      </div>

      <AttachmentPicker value={attachments} onChange={setAttachments} onUploadingChange={setUploading} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
        <Toggle checked={notify} onChange={setNotify} label="Notify all members" />
        Notify all members
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            borderRadius: 'var(--r-pill)',
            border: '0.5px solid var(--border-default)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canPost}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            borderRadius: 'var(--r-pill)',
            border: 'none',
            background: 'var(--uc-indigo)',
            color: 'var(--on-accent)',
            cursor: canPost ? 'pointer' : 'not-allowed',
            opacity: canPost ? 1 : 0.6,
            fontFamily: 'inherit',
          }}
        >
          Post announcement
        </button>
      </div>
    </div>
  )
}
