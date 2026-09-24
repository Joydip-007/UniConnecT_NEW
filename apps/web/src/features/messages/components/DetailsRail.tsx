import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart2, Bell, BellOff, BookOpen, ChevronDown, PackageSearch, Pin, PinOff, User, Users } from 'lucide-react'
import { QUICK_EMOJIS, type ChatTheme } from '@uniconnect/shared'
import { PATHS } from '@/router/paths'
import type { Conversation } from '../types'
import { CHAT_THEMES, chatTheme, conversationAvatar, conversationSubtitle, conversationTitle, fileMeta, fileTone, isOneToOne } from '../threadModel'
import { initials, seedColor } from '../utils'
import { useCommonGroups, useSharedFiles, useUpdatePreferences } from '../hooks/useMessagesData'
import { MsgAvatar } from './MsgPrimitives'

const TONE = {
  doc: { icon: BookOpen, bg: 'var(--uc-indigo-bg)', fg: 'var(--uc-indigo-l)' },
  pdf: { icon: PackageSearch, bg: 'var(--uc-mint-bg)', fg: 'var(--uc-mint)' },
  sheet: { icon: BarChart2, bg: 'var(--uc-amber-bg)', fg: 'var(--uc-amber-l)' },
} as const

interface DetailsRailProps {
  conv: Conversation
  /** `sheet` = full-screen overlay (mobile) with a back button. */
  variant: 'rail' | 'sheet'
  onClose: () => void
  onReport: (() => void) | null
}

export function DetailsRail({ conv, variant, onClose, onReport }: DetailsRailProps) {
  const navigate = useNavigate()
  const [filesOpen, setFilesOpen] = useState(true)
  const [groupsOpen, setGroupsOpen] = useState(true)
  const [customOpen, setCustomOpen] = useState(false)
  const [allFiles, setAllFiles] = useState(false)
  const oneToOne = isOneToOne(conv)
  const title = conversationTitle(conv)
  const avatar = conversationAvatar(conv)
  const prefs = useUpdatePreferences(conv.id)
  const files = useSharedFiles(conv.id, allFiles ? 50 : 3)
  const groups = useCommonGroups(conv.id, oneToOne)
  const theme = chatTheme(conv.chatTheme)
  const quickEmoji = conv.quickEmoji ?? '👍'

  const profileTarget = oneToOne
    ? conv.otherParticipant && PATHS.PROFILE.replace(':id', conv.otherParticipant.id)
    : conv.group && PATHS.GROUP_DETAIL.replace(':id', conv.group.id)

  const actions: { icon: typeof User; label: string; onPress: () => void; disabled?: boolean }[] = [
    {
      icon: oneToOne ? User : Users,
      label: oneToOne ? 'Profile' : 'Group',
      onPress: () => profileTarget && navigate(profileTarget),
      disabled: !profileTarget,
    },
    {
      icon: conv.isMuted ? Bell : BellOff,
      label: conv.isMuted ? 'Unmute' : 'Mute',
      onPress: () => prefs.mutate({ isMuted: !conv.isMuted }),
    },
    {
      icon: conv.isPinned ? PinOff : Pin,
      label: conv.isPinned ? 'Unpin' : 'Pin',
      onPress: () => prefs.mutate({ isPinned: !conv.isPinned }),
    },
  ]

  const members = conv.participants ?? []

  return (
    <aside className="msgx-details msgx-scroll" aria-label="Conversation details">
      {variant === 'sheet' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -6 }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to conversation"
            className="msgx-hover"
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--r-pill)',
              border: 'none',
              background: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Details</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ borderRadius: '50%', background: 'var(--tenant-accent)', padding: 1.5, lineHeight: 0 }}>
          <div style={{ borderRadius: '50%', border: '2px solid var(--surface-page)', lineHeight: 0 }}>
            <MsgAvatar size={64} fontSize={20} initials={avatar.initials} color={avatar.color} src={avatar.src} />
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'center' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>{conversationSubtitle(conv)}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {actions.map(({ icon: Icon, label, onPress, disabled }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 56 }}>
            <button
              type="button"
              onClick={onPress}
              disabled={disabled}
              aria-label={label}
              className="msgx-hover"
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--r-pill)',
                border: '0.5px solid var(--border-default)',
                background: 'var(--surface-card)',
                color: 'var(--text-secondary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={16} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)', textAlign: 'center' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <Section title="Shared files" open={filesOpen} onToggle={() => setFilesOpen((v) => !v)}>
        {(files.data ?? []).map((f) => {
          const tone = TONE[fileTone(f.name, f.mimeType)]
          const Icon = tone.icon
          return (
            <a
              key={`${f.messageId}-${f.url}`}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              download={f.name}
              className="msgx-hover"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderBottom: '0.5px solid var(--border-default)',
                textDecoration: 'none',
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--r-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: tone.bg,
                  color: tone.fg,
                  flexShrink: 0,
                }}
              >
                <Icon size={15} />
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fileMeta(f.name, f.size)}</span>
              </span>
            </a>
          )
        })}
        {files.data && files.data.length === 0 ? (
          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>No files shared yet</div>
        ) : (
          (allFiles || (files.data?.length ?? 0) >= 3) && (
            <button
              type="button"
              onClick={() => setAllFiles((v) => !v)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                color: 'var(--uc-indigo-l)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {allFiles ? 'Show fewer' : 'See all files'}
            </button>
          )
        )}
      </Section>

      {oneToOne ? (
        <Section title="Groups in common" open={groupsOpen} onToggle={() => setGroupsOpen((v) => !v)}>
          {(groups.data ?? []).map((g) => (
            <RailRow
              key={g.id}
              leading={
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--r-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--on-accent)',
                    background: seedColor(g.id),
                    flexShrink: 0,
                  }}
                >
                  {initials(g.name)}
                </span>
              }
              name={g.name}
              meta={`${g.memberCount} member${g.memberCount === 1 ? '' : 's'}`}
              onPress={() => navigate(PATHS.GROUP_DETAIL.replace(':id', g.id))}
            />
          ))}
          {groups.data && groups.data.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>No groups in common</div>
          )}
        </Section>
      ) : (
        <Section title="Members" open={groupsOpen} onToggle={() => setGroupsOpen((v) => !v)}>
          {members.map((p) => (
            <RailRow
              key={p.userId}
              leading={<MsgAvatar size={32} fontSize={11} initials={initials(p.user.fullName)} color={seedColor(p.userId)} src={p.user.avatarUrl} />}
              name={p.user.fullName}
              meta={p.user.headline ?? p.user.role}
              onPress={() => navigate(PATHS.PROFILE.replace(':id', p.userId))}
            />
          ))}
        </Section>
      )}

      <Section title="Customize chatbox" open={customOpen} onToggle={() => setCustomOpen((v) => !v)}>
        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Default emoji</span>
            <div role="radiogroup" aria-label="Default emoji" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
              {QUICK_EMOJIS.map((e) => {
                const on = e === quickEmoji
                return (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={e}
                    onClick={() => prefs.mutate({ quickEmoji: e })}
                    className="msgx-hover"
                    style={{
                      height: 36,
                      borderRadius: 'var(--r-sm)',
                      border: `0.5px solid ${on ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                      background: on ? 'var(--uc-indigo-bg)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: 18,
                      lineHeight: 1,
                      fontFamily: 'var(--font-emoji, inherit)',
                    }}
                  >
                    {e}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Theme</span>
            <div role="radiogroup" aria-label="Chat theme" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CHAT_THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={t.key === theme.key}
                  onClick={() => prefs.mutate({ chatTheme: t.key as ChatTheme })}
                  title={t.label}
                  aria-label={t.label}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: `2px solid ${t.key === theme.key ? t.color : 'transparent'}`,
                    padding: 2,
                    background: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: t.color }} />
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {theme.label} · applies to your bubbles and the send button
            </span>
          </div>
        </div>
      </Section>

      {onReport && (
        <button
          type="button"
          onClick={onReport}
          style={{
            width: '100%',
            height: 36,
            flexShrink: 0,
            borderRadius: 'var(--r-pill)',
            border: '0.5px solid var(--uc-red-bdr)',
            background: 'var(--uc-red-bg)',
            color: 'var(--uc-red)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Report conversation
        </button>
      )}
    </aside>
  )
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div
      style={{
        flexShrink: 0,
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          background: 'none',
          border: 'none',
          borderBottom: `0.5px solid ${open ? 'var(--border-default)' : 'transparent'}`,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: 'var(--text-label)',
        }}
      >
        <span>{title}</span>
        <span
          style={{
            display: 'flex',
            color: 'var(--text-tertiary)',
            transition: 'transform var(--dur-med) var(--ease-out-strong)',
            transform: `rotate(${open ? '0deg' : '-90deg'})`,
          }}
        >
          <ChevronDown size={14} />
        </span>
      </button>
      {open && children}
    </div>
  )
}

function RailRow({ leading, name, meta, onPress }: { leading: ReactNode; name: string; meta: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="msgx-hover"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 14px',
        border: 'none',
        borderBottom: '0.5px solid var(--border-default)',
        background: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {leading}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>
      </span>
    </button>
  )
}
