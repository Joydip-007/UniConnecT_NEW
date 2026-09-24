import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Eye, Film, Image as ImageIcon, PackageSearch, Paperclip, Plus, Rocket, Smile, X } from 'lucide-react'
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENTS_PER_ENTITY,
  MAX_ATTACHMENT_SIZE_BYTES,
  isAllowedAttachment,
  type MessageAttachment,
} from '@uniconnect/shared'
import { useEmojiInsert } from '@/hooks/useEmojiInsert'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import { socket } from '@/lib/socket'
import { formatBytes } from '../threadModel'

const EmojiPicker = lazy(() => import('@/components/emoji/EmojiPicker').then((m) => ({ default: m.EmojiPicker })))
const StickerDrawer = lazy(() => import('@/components/emoji/StickerDrawer').then((m) => ({ default: m.StickerDrawer })))

const FILE_ACCEPT = ALLOWED_ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(',')

interface StagedFile {
  key: string
  file: File
}

interface ImageDraft {
  file: File
  url: string
  once: boolean
}

export interface ComposerSend {
  text: (body: string) => void
  attachments: (attachments: MessageAttachment[], viewOnce: boolean) => Promise<unknown>
  sticker: (url: string) => void
  edit: (id: string, body: string) => void
}

interface ThreadComposerProps {
  convId: string
  variant: 'desktop' | 'mobile'
  themeColor: string
  quickEmoji: string
  /** A message being edited: its text is loaded into the input and Send saves it. */
  editing: { id: string; body: string } | null
  onCancelEdit: () => void
  send: ComposerSend
  toast: string
  notify: (text: string) => void
}

export function ThreadComposer({
  convId,
  variant,
  themeColor,
  quickEmoji,
  editing,
  onCancelEdit,
  send,
  toast,
  notify,
}: ThreadComposerProps) {
  const mobile = variant === 'mobile'
  const [draft, setDraft] = useState('')
  const [picker, setPicker] = useState(false)
  const [attachMenu, setAttachMenu] = useState(false)
  const [stickers, setStickers] = useState(false)
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [attachError, setAttachError] = useState('')
  const [imageDraft, setImageDraft] = useState<ImageDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const lastTypingRef = useRef(0)
  const insertEmoji = useEmojiInsert(inputRef, draft, setDraft)
  const { upload } = usePresignedUpload('messages')

  // A new thread starts with an empty composer.
  useEffect(() => {
    setDraft('')
    setPicker(false)
    setAttachMenu(false)
    setStickers(false)
    setStaged([])
    setAttachError('')
    setImageDraft(null)
    lastTypingRef.current = 0
  }, [convId])

  useEffect(() => {
    if (editing) {
      setDraft(editing.body)
      inputRef.current?.focus()
    }
  }, [editing])

  // Revoke a preview URL once its draft is replaced or dropped — keyed on the URL,
  // not the draft object, so toggling view-once does not revoke a live preview.
  const previewUrl = imageDraft?.url
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const hasContent = !!(draft.trim() || staged.length || imageDraft)

  function stopTyping() {
    if (lastTypingRef.current) socket.emit('conv:typing:stop', { conversationId: convId })
    lastTypingRef.current = 0
  }

  function onDraftChange(next: string) {
    setDraft(next)
    if (!next) {
      stopTyping()
      return
    }
    const now = Date.now()
    if (now - lastTypingRef.current >= 2000) {
      socket.emit('conv:typing:start', { conversationId: convId })
      lastTypingRef.current = now
    }
  }

  function onPickFiles(list: FileList | null) {
    const files = Array.from(list ?? [])
    const next = staged.slice()
    let err = ''
    for (const f of files) {
      if (next.length >= MAX_ATTACHMENTS_PER_ENTITY) {
        err = `You can attach up to ${MAX_ATTACHMENTS_PER_ENTITY} files`
        break
      }
      if (f.size > MAX_ATTACHMENT_SIZE_BYTES) {
        err = `"${f.name}" is too large (max 25 MB)`
        continue
      }
      if (!isAllowedAttachment(f.name, f.type)) {
        err = `"${f.name}" is not an allowed file type`
        continue
      }
      next.push({ key: `${f.name}-${f.size}-${f.lastModified}-${next.length}`, file: f })
    }
    setStaged(next)
    setAttachError(err)
  }

  function onPickImage(list: FileList | null) {
    const f = list?.[0]
    if (!f) return
    if (f.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setAttachError(`"${f.name}" is too large (max 25 MB)`)
      return
    }
    setAttachError('')
    setImageDraft({ file: f, url: URL.createObjectURL(f), once: false })
  }

  async function toAttachment(file: File): Promise<MessageAttachment> {
    const url = await upload(file)
    return { url, name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' }
  }

  async function handleSend() {
    if (busy) return
    const text = draft.trim()

    if (editing) {
      if (text && text !== editing.body) send.edit(editing.id, text)
      setDraft('')
      onCancelEdit()
      return
    }

    if (!hasContent) {
      send.text(quickEmoji)
      return
    }

    stopTyping()
    setPicker(false)
    const image = imageDraft
    const files = staged
    setDraft('')

    if (image || files.length) {
      setBusy(true)
      notify('Uploading…')
      try {
        if (image) {
          await send.attachments([await toAttachment(image.file)], image.once)
          setImageDraft(null)
        }
        // One bubble per file, the way they were picked.
        for (const f of files) {
          await send.attachments([await toAttachment(f.file)], false)
          setStaged((prev) => prev.filter((s) => s.key !== f.key))
        }
        notify('')
      } catch {
        setAttachError('Upload failed. Check your connection and try again.')
        notify('')
      } finally {
        setBusy(false)
      }
    }
    if (text) send.text(text)
  }

  const closePopovers = () => {
    setPicker(false)
    setAttachMenu(false)
    setStickers(false)
  }

  const size = mobile ? 44 : 38
  const sendLabel = editing ? 'Save edit' : hasContent ? 'Send' : `Send ${quickEmoji}`
  // The mobile design keeps the rocket on the theme colour even when the field is empty.
  const showQuickEmoji = !hasContent && !editing && !mobile

  return (
    <div
      style={{
        flexShrink: 0,
        padding: mobile ? '10px 12px 20px' : '10px 16px 16px',
        paddingBottom: mobile ? 'calc(20px + env(safe-area-inset-bottom, 0px))' : 16,
        borderTop: '0.5px solid var(--border-default)',
      }}
    >
      {toast && (
        <div role="status" style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-hover)',
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            {toast}
          </span>
        </div>
      )}

      {picker && (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: 8, left: 0, zIndex: 60 }}>
            <Suspense fallback={null}>
              <EmojiPicker
                onSelect={(e) => {
                  insertEmoji(e)
                  setPicker(false)
                }}
                onClose={() => setPicker(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {staged.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
          {staged.map((f) => (
            <span
              key={f.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                background: 'var(--surface-page)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-pill)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                maxWidth: 240,
              }}
            >
              <Paperclip size={12} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatBytes(f.file.size)}</span>
              <button
                type="button"
                onClick={() => setStaged((prev) => prev.filter((s) => s.key !== f.key))}
                aria-label={`Remove ${f.file.name}`}
                disabled={busy}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, lineHeight: 0, display: 'flex' }}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      {attachError && (
        <p role="alert" style={{ margin: 0, paddingBottom: 8, fontSize: 12, color: 'var(--uc-red)' }}>
          {attachError}
        </p>
      )}

      {attachMenu && (
        <div style={{ position: 'relative' }}>
          <div
            role="menu"
            style={{
              position: 'absolute',
              bottom: 8,
              left: 0,
              zIndex: 60,
              minWidth: 180,
              padding: 6,
              borderRadius: 'var(--r-md)',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-hover)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {[
              { icon: Film, label: 'GIF & Stickers', onPress: () => { closePopovers(); setStickers(true) } },
              { icon: ImageIcon, label: 'Image', onPress: () => { closePopovers(); imageRef.current?.click() } },
              { icon: Paperclip, label: 'Attachment', onPress: () => { closePopovers(); fileRef.current?.click() } },
            ].map(({ icon: Icon, label, onPress }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={onPress}
                className="msgx-hover"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  minHeight: 36,
                  padding: '8px 10px',
                  background: 'none',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>
                  <Icon size={15} />
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {stickers && (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: 8, left: 0, zIndex: 60 }}>
            <Suspense fallback={null}>
              <StickerDrawer
                onSelect={(url) => {
                  send.sticker(url)
                  setStickers(false)
                }}
                onClose={() => setStickers(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      <input
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={(e) => {
          onPickImage(e.target.files)
          e.target.value = ''
        }}
        style={{ display: 'none' }}
      />
      {imageDraft && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 10,
            marginBottom: 8,
            borderRadius: 'var(--r-lg)',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          <img src={imageDraft.url} alt="" style={{ width: 56, height: 56, borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {imageDraft.file.name}
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { once: false, label: 'Keep in chat', icon: ImageIcon },
                { once: true, label: 'View once', icon: Eye },
              ].map(({ once, label, icon: Icon }) => {
                const on = imageDraft.once === once
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setImageDraft({ ...imageDraft, once })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      borderRadius: 'var(--r-pill)',
                      border: `0.5px solid ${on ? 'var(--uc-indigo)' : 'var(--border-default)'}`,
                      background: on ? 'var(--uc-indigo)' : 'var(--surface-card)',
                      color: on ? 'var(--on-indigo)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                )
              })}
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {imageDraft.once ? 'Disappears after it’s opened' : 'Stays in the conversation'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setImageDraft(null)}
            aria-label="Remove image"
            className="msgx-hover"
            style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--r-pill)',
              border: 'none',
              background: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={`${FILE_ACCEPT},image/*`}
        onChange={(e) => {
          onPickFiles(e.target.files)
          e.target.value = ''
        }}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', alignItems: mobile ? 'center' : 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={() => {
            setAttachMenu((v) => !v)
            setStickers(false)
            setPicker(false)
          }}
          aria-label="Attach files"
          title="Attach files"
          aria-expanded={attachMenu}
          className="msgx-hover"
          style={{
            width: size,
            height: size,
            flexShrink: 0,
            borderRadius: 'var(--r-pill)',
            border: '0.5px solid var(--border-default)',
            background: 'var(--surface-raised)',
            color: staged.length || attachMenu || stickers ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {mobile ? <PackageSearch size={17} /> : <Plus size={18} />}
        </button>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            padding: '0 8px 0 16px',
            height: size,
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void handleSend()
              }
              if (e.key === 'Escape' && editing) {
                setDraft('')
                onCancelEdit()
              }
            }}
            onBlur={stopTyping}
            placeholder={editing ? 'Edit message' : 'Write a message'}
            aria-label={editing ? 'Edit message. Press Enter to save, Escape to cancel.' : 'Write a message. Press Enter to send.'}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
            }}
          />
          <button
            type="button"
            onClick={() => {
              setPicker((v) => !v)
              setAttachMenu(false)
              setStickers(false)
            }}
            aria-label="Emoji"
            aria-expanded={picker}
            style={{
              width: mobile ? 30 : 28,
              height: mobile ? 30 : 28,
              borderRadius: 'var(--r-pill)',
              border: 'none',
              background: 'none',
              color: picker ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Smile size={mobile ? 17 : 16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => void handleSend()}
          aria-label={sendLabel}
          title={sendLabel}
          disabled={busy}
          className="msgx-send"
          style={{
            width: size,
            height: size,
            flexShrink: 0,
            borderRadius: 'var(--r-pill)',
            border: 'none',
            background: showQuickEmoji ? 'transparent' : themeColor,
            color: 'var(--on-accent)',
            cursor: busy ? 'progress' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            lineHeight: 1,
            padding: 0,
            fontFamily: 'var(--font-emoji, inherit)',
          }}
        >
          {showQuickEmoji ? <span>{quickEmoji}</span> : <Rocket size={mobile ? 17 : 15} />}
        </button>
      </div>
    </div>
  )
}
