import type { ReactNode } from 'react'
import type { MessageAttachment } from '@uniconnect/shared'
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MoreVertical,
  PackageSearch,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Smile,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import klipyWatermark from '@/assets/klipy/klipy-watermark-light.svg'
import type { MessageReactionKey } from '@/components/emoji/reactionConfig'
import type { Message } from '../types'
import { QUICK_REACTIONS, bubbleTime, fileMeta, myReaction, reactionSummary, type ThreadRow } from '../threadModel'
import { initials, seedColor } from '../utils'
import { eyebrowStyle } from '../msgStyles'
import { MsgAvatar } from './MsgPrimitives'

type MsgRow = Extract<ThreadRow, { kind: 'msg' }>
type Variant = 'desktop' | 'mobile'

export interface ThreadMessageHandlers {
  onToggleReact: () => void
  onToggleMenu: () => void
  onTouchHot: () => void
  onReact: (key: MessageReactionKey | null) => void
  onForward: () => void
  onEdit: () => void
  onRemove: () => void
  onReport: () => void
  onHideForMe: () => void
  onOpenImage: (urls: string[], index: number) => void
  onOpenOnce: () => void
}

interface ThreadMessageProps extends ThreadMessageHandlers {
  row: MsgRow
  variant: Variant
  themeColor: string
  myUserId: string | undefined
  open: 'react' | 'menu' | null
  menuUp: boolean
  highlight: 'none' | 'match' | 'current'
  pending?: { status: 'sending' | 'error'; onRetry: () => void }
}

const timePillStyle: React.CSSProperties = {
  position: 'absolute',
  right: 8,
  bottom: 8,
  padding: '3px 7px',
  borderRadius: 'var(--r-pill)',
  background: 'var(--overlay-media)',
  color: 'var(--on-accent)',
  fontSize: 11,
  lineHeight: 1,
}

const onBubbleMuted = 'color-mix(in srgb, var(--on-accent) 78%, transparent)'

export function ThreadMessage(props: ThreadMessageProps) {
  const { row, variant, themeColor, myUserId, open, menuUp, highlight, pending } = props
  const m: Message = row.message
  const mine = row.mine
  const mobile = variant === 'mobile'
  const time = `${m.editedAt && !m.isDeleted ? 'edited · ' : ''}${bubbleTime(m.sentAt)}`
  const toolsEnabled = !m.isDeleted && !pending
  const reaction = m.isDeleted ? null : reactionSummary(m.reactions)
  const mineReaction = myReaction(m.reactions, myUserId)
  const outline =
    highlight === 'current' ? '2px solid var(--uc-amber)' : highlight === 'match' ? '1px solid var(--uc-amber-bdr)' : 'none'

  const tail = row.lastOfRun ? 'var(--r-sm)' : 'var(--r-lg)'
  const attachments = m.attachments ?? []
  const images = attachments.filter((a) => a.mimeType.startsWith('image/'))
  const files = attachments.filter((a) => !a.mimeType.startsWith('image/'))

  // ── Bubbles ─────────────────────────────────────────────────────────────────

  const bubbles: ReactNode[] = []

  if (m.isDeleted) {
    bubbles.push(
      <div
        key="removed"
        style={{
          padding: mobile ? '8px 13px' : '9px 14px',
          borderRadius: 'var(--r-lg)',
          border: `0.5px dashed ${mine ? 'var(--uc-indigo-bdr)' : 'var(--border-hover)'}`,
          fontSize: mobile ? 13 : 14,
          color: 'var(--text-tertiary)',
        }}
      >
        {mine ? 'You removed this message' : 'This message was removed'}
      </div>,
    )
  } else if (m.viewOnce) {
    bubbles.push(
      m.viewOnce.opened ? (
        <div
          key="once"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 14px',
            borderRadius: 'var(--r-lg)',
            border: '0.5px dashed var(--border-hover)',
            fontSize: 14,
            color: 'var(--text-tertiary)',
          }}
        >
          <EyeOff size={15} />
          Opened
          <span style={{ fontSize: 11, marginLeft: 6 }}>{time}</span>
        </div>
      ) : (
        <button
          key="once"
          type="button"
          onClick={mine ? undefined : props.onOpenOnce}
          disabled={mine}
          aria-label={mine ? 'View-once photo you sent' : 'Open view-once photo'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 'var(--r-lg)',
            border: mine ? 'none' : '0.5px solid var(--border-default)',
            background: mine ? themeColor : 'var(--surface-raised)',
            color: mine ? 'var(--on-accent)' : 'var(--text-primary)',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: mine ? 'default' : 'pointer',
          }}
        >
          <Eye size={15} />
          Photo · view once
          <span style={{ fontSize: 11, fontWeight: 400, color: mine ? onBubbleMuted : 'var(--text-tertiary)', marginLeft: 6 }}>
            {time}
          </span>
        </button>
      ),
    )
  } else if (m.contentType === 'sticker' && m.stickerUrl) {
    bubbles.push(
      <div
        key="sticker"
        style={{
          position: 'relative',
          width: 160,
          height: 160,
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          background: 'repeating-linear-gradient(135deg, var(--surface-raised) 0 8px, var(--surface-hover) 8px 16px)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <img src={m.stickerUrl} alt="Sticker" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        <img
          src={klipyWatermark}
          alt="KLIPY"
          style={{ position: 'absolute', bottom: 6, left: 6, height: 18, width: 'auto', pointerEvents: 'none', userSelect: 'none' }}
        />
        <span style={timePillStyle}>{time}</span>
      </div>,
    )
  } else {
    if (images.length > 0) {
      const w = mobile ? 190 : mine ? 240 : 260
      bubbles.push(
        <ImageBubble
          key="images"
          images={images}
          width={w}
          height={mobile ? 130 : mine ? undefined : 176}
          time={m.body ? null : time}
          onOpen={(i) => props.onOpenImage(images.map((a) => a.url), i)}
        />,
      )
    }
    files.forEach((f, i) =>
      bubbles.push(
        <FileBubble key={`f${i}`} file={f} mine={mine} mobile={mobile} time={m.body ? bubbleTime(m.sentAt) : time} />,
      ),
    )
    if (m.body || attachments.length === 0) {
      bubbles.push(
        <div
          key="text"
          data-hit-current={highlight === 'current' ? 'true' : undefined}
          style={{
            padding: mobile ? '9px 13px' : '10px 14px',
            borderRadius: 'var(--r-lg)',
            ...(mine ? { borderBottomRightRadius: tail } : { borderBottomLeftRadius: tail }),
            background: mine ? themeColor : 'var(--surface-raised)',
            border: mine ? `0.5px solid ${pending?.status === 'error' ? 'var(--uc-red-bdr)' : 'transparent'}` : '0.5px solid var(--border-default)',
            color: mine ? 'var(--on-accent)' : 'var(--text-primary)',
            fontSize: mobile ? 14 : 15,
            lineHeight: mobile ? 1.6 : 1.72,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            outline,
            outlineOffset: 2,
          }}
        >
          {m.body}
          <span
            style={{
              float: 'right',
              margin: '8px 0 -6px 12px',
              fontSize: 11,
              lineHeight: 1,
              color: mine ? onBubbleMuted : 'var(--text-tertiary)',
            }}
          >
            {time}
          </span>
        </div>,
      )
    }
  }

  // ── Tools, reaction bar, menu ───────────────────────────────────────────────

  const toolW = mobile ? 26 : 28
  const toolH = mobile ? 41 : 46
  const tools = toolsEnabled ? (
    <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
      {(
        [
          { icon: Smile, title: 'React', onPress: props.onToggleReact },
          { icon: ExternalLink, title: 'Forward', onPress: props.onForward },
          { icon: MoreVertical, title: 'More', onPress: props.onToggleMenu },
        ] as { icon: LucideIcon; title: string; onPress: () => void }[]
      ).map(({ icon: Icon, title, onPress }) => (
        <button
          key={title}
          type="button"
          onClick={onPress}
          title={title}
          aria-label={title}
          className="msgx-tool msgx-tool-btn"
          style={{
            width: toolW,
            height: toolH,
            flexShrink: 0,
            borderRadius: 'var(--r-pill)',
            border: 'none',
            background: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: open ? 1 : undefined,
          }}
        >
          <Icon size={16} />
        </button>
      ))}

      {open === 'react' && (
        <div
          role="menu"
          aria-label="React"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            zIndex: 70,
            display: 'flex',
            gap: 2,
            padding: 4,
            borderRadius: 'var(--r-pill)',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-hover)',
          }}
        >
          {QUICK_REACTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              role="menuitemradio"
              aria-checked={mineReaction === r.key}
              aria-label={r.label}
              title={r.label}
              onClick={() => props.onReact(mineReaction === r.key ? null : r.key)}
              className="msgx-hover"
              style={{
                width: mobile ? 28 : 30,
                height: mobile ? 28 : 30,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                background: mineReaction === r.key ? 'var(--surface-hover)' : 'none',
                cursor: 'pointer',
                fontSize: mobile ? 15 : 16,
                lineHeight: 1,
                fontFamily: 'var(--font-emoji, inherit)',
              }}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}

      {open === 'menu' && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: menuUp ? 'auto' : 'calc(100% + 6px)',
            bottom: menuUp ? 'calc(100% + 6px)' : 'auto',
            right: 0,
            zIndex: 70,
            minWidth: mobile ? 166 : 170,
            padding: 6,
            borderRadius: 'var(--r-md)',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-hover)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {(mine
            ? [
                ...(m.contentType === 'text' || (!m.contentType && !attachments.length)
                  ? [{ icon: Pencil, label: 'Edit message', danger: false, onPress: props.onEdit }]
                  : []),
                { icon: ExternalLink, label: 'Forward', danger: false, onPress: props.onForward },
                { icon: Trash2, label: 'Remove', danger: true, onPress: props.onRemove },
              ]
            : [
                { icon: ExternalLink, label: 'Forward', danger: false, onPress: props.onForward },
                { icon: ShieldCheck, label: 'Report', danger: false, onPress: props.onReport },
                { icon: Trash2, label: 'Remove for me', danger: true, onPress: props.onHideForMe },
              ]
          ).map(({ icon: Icon, label, danger, onPress }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={onPress}
              className="msgx-hover"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 10px',
                background: 'none',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                textAlign: 'left',
                color: danger ? 'var(--uc-red)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null

  const reactionChip = reaction ? (
    <span
      title={Object.values(m.reactions ?? {})
        .flat()
        .map((u) => u.fullName)
        .join(', ')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--surface-hover)',
        border: '0.5px solid var(--border-default)',
        fontSize: 12,
        color: 'var(--text-secondary)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-emoji, inherit)' }}>{reaction.emojis}</span> {reaction.count}
    </span>
  ) : null

  const bubbleStack =
    bubbles.length === 1 ? (
      bubbles[0]
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: mine ? 'flex-end' : 'flex-start', minWidth: 0 }}>
        {bubbles}
      </div>
    )

  const rowProps = {
    className: 'msgx-row',
    'data-hot': open ? 'true' : undefined,
    onClick: mobile ? (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, a')) return
      props.onTouchHot()
    } : undefined,
  }

  const statusLine =
    pending?.status === 'sending' ? (
      <Loader2 size={11} className="spin" aria-label="Sending" style={{ color: 'var(--text-tertiary)' }} />
    ) : pending?.status === 'error' ? (
      <button
        type="button"
        onClick={pending.onRetry}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--uc-red-bg)',
          border: '0.5px solid var(--uc-red-bdr)',
          color: 'var(--uc-red)',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <RotateCcw size={11} />
        Not sent · retry
      </button>
    ) : null

  if (!mine) {
    const avatarSize = mobile ? 26 : 28
    return (
      <div
        {...rowProps}
        style={{ display: 'flex', gap: mobile ? 8 : 10, alignItems: 'flex-end', marginBottom: row.lastOfRun ? 10 : 2 }}
      >
        <div style={{ width: avatarSize, flexShrink: 0 }}>
          {row.showAvatar && (
            <MsgAvatar
              size={avatarSize}
              fontSize={10}
              initials={initials(m.sender.fullName)}
              color={seedColor(m.sender.id)}
              src={m.sender.profile.avatarUrl}
            />
          )}
        </div>
        <div style={{ maxWidth: mobile ? '74%' : '76%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          {row.showSender && <span style={{ ...eyebrowStyle, paddingLeft: 4 }}>{m.sender.fullName}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, maxWidth: '100%' }}>
            {bubbleStack}
            {tools}
          </div>
          {mobile ? (
            reactionChip
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>{reactionChip}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      {...rowProps}
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        gap: mobile ? 8 : 10,
        marginBottom: row.lastOfRun ? 10 : 2,
        opacity: pending?.status === 'sending' ? 0.6 : 1,
        transition: 'opacity var(--dur-fast)',
      }}
    >
      <div style={{ maxWidth: mobile ? '74%' : '76%', display: 'flex', flexDirection: 'column', gap: mobile ? 3 : 4, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, maxWidth: '100%' }}>
          {tools}
          {bubbleStack}
        </div>
        {mobile ? (
          <>
            {reactionChip}
            {row.read && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                Seen
                <span style={{ color: 'var(--uc-mint)', lineHeight: 0 }}>
                  <CheckCircle2 size={12} />
                </span>
              </span>
            )}
            {statusLine}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 4 }}>
            {reactionChip}
            {row.read && (
              <span title="Seen" aria-label="Seen" style={{ color: 'var(--uc-mint)', lineHeight: 0 }}>
                <CheckCircle2 size={13} />
              </span>
            )}
            {statusLine}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Media bubbles ─────────────────────────────────────────────────────────────

function ImageBubble({
  images,
  width,
  height,
  time,
  onOpen,
}: {
  images: MessageAttachment[]
  width: number
  height: number | undefined
  time: string | null
  onOpen: (index: number) => void
}) {
  const multi = images.length > 1
  return (
    <div
      style={{
        position: 'relative',
        width,
        flexShrink: 0,
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        border: '0.5px solid var(--border-default)',
        background: 'var(--surface-raised)',
        display: 'grid',
        gridTemplateColumns: multi ? '1fr 1fr' : '1fr',
        gap: multi ? 2 : 0,
        lineHeight: 0,
      }}
    >
      {images.slice(0, 4).map((img, i) => (
        <button
          key={img.url || i}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={`Open ${img.name}`}
          style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', display: 'block' }}
        >
          <img
            src={img.url}
            alt={img.name}
            style={{
              width: '100%',
              height: multi ? width / 2 : height,
              maxHeight: height ? undefined : 320,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </button>
      ))}
      {time && <span style={timePillStyle}>{time}</span>}
    </div>
  )
}

function FileBubble({ file, mine, mobile, time }: { file: MessageAttachment; mine: boolean; mobile: boolean; time: string }) {
  const Icon = mine ? PackageSearch : BookOpen
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      download={file.name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: mobile ? '9px 13px 9px 9px' : '10px 14px 10px 10px',
        borderRadius: 'var(--r-lg)',
        background: mine ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
        border: `0.5px solid ${mine ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
        textDecoration: 'none',
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: mobile ? 32 : 36,
          height: mobile ? 32 : 36,
          borderRadius: 'var(--r-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: mine ? 'var(--surface-raised)' : 'var(--uc-indigo-bg)',
          color: 'var(--uc-indigo-l)',
          flexShrink: 0,
        }}
      >
        <Icon size={mobile ? 15 : 16} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: mobile ? 13 : 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file.name}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {fileMeta(file.name, file.size)} · {time}
        </span>
      </span>
    </a>
  )
}
