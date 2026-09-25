import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bookmark,
  BookmarkMinus,
  CheckCircle2,
  Flag,
  Link2,
  MapPin,
  MoreHorizontal,
  Phone,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { ImageLightbox } from '@/components/ImageLightbox'
import { useShareLink } from '@/features/share/hooks/useShareLink'
import { ReportModal } from '@/features/moderation/components/ReportModal'
import { getInitials, relativeTime, seedColor } from '../constants'
import { useLostFoundActions } from '../hooks/useLostFoundActions'
import type { LostFoundItem } from '../types'
import { TypeBadge } from './TypeBadge'

interface LostFoundCardProps {
  item: LostFoundItem
  currentUserId: string | undefined
  isAdmin: boolean
  /** Phones get 44px touch targets and the short "Resolve" label. */
  compact?: boolean
}

interface MenuEntry {
  label: string
  icon: LucideIcon
  danger?: boolean
  onSelect: () => void
}

export function LostFoundCard({ item, currentUserId, isAdmin, compact = false }: LostFoundCardProps) {
  const [showContact, setShowContact] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isOwn = currentUserId === item.authorId
  const { resolve, pin, remove, save } = useLostFoundActions(item.id)
  const { copy } = useShareLink('lost-found', item.id, item.itemName)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const copyLink: MenuEntry = { label: 'Copy link', icon: Link2, onSelect: () => void copy() }

  // An admin moderates the board; everyone else saves, shares and reports. A poster
  // cannot report their own item, so they get delete in its place.
  const menu: MenuEntry[] = isAdmin
    ? [
        item.isResolved
          ? { label: 'Reopen this post', icon: RotateCcw, onSelect: () => resolve.mutate(false) }
          : { label: 'Mark as resolved', icon: CheckCircle2, onSelect: () => resolve.mutate(true) },
        copyLink,
        item.isPinned
          ? { label: 'Unpin from board', icon: PinOff, onSelect: () => pin.mutate(false) }
          : { label: 'Pin to board', icon: Pin, onSelect: () => pin.mutate(true) },
        {
          label: 'Remove post',
          icon: Trash2,
          danger: true,
          onSelect: () => {
            if (window.confirm(`Remove “${item.itemName}” from the board? This cannot be undone.`)) remove.mutate()
          },
        },
      ]
    : [
        item.isSaved
          ? { label: 'Remove from saved', icon: BookmarkMinus, onSelect: () => save.mutate(false) }
          : { label: 'Save item', icon: Bookmark, onSelect: () => save.mutate(true) },
        copyLink,
        isOwn
          ? {
              label: 'Delete post',
              icon: Trash2,
              danger: true,
              onSelect: () => {
                if (window.confirm(`Delete “${item.itemName}”? This cannot be undone.`)) remove.mutate()
              },
            }
          : { label: 'Report post', icon: Flag, danger: true, onSelect: () => setReportOpen(true) },
      ]

  const canResolve = isOwn && !item.isResolved
  const buttonHeight = compact ? 44 : undefined
  const buttonPadding = compact ? '0 16px' : '6px 14px'

  return (
    <div
      // The share link is `/lost-found#<id>`, so the card is its own anchor.
      id={item.id}
      style={{
        background: 'var(--surface-card)',
        border: `0.5px solid ${item.isResolved ? 'var(--uc-mint-bdr)' : 'var(--border-default)'}`,
        borderRadius: 'var(--r-lg)',
        padding: compact ? 14 : 16,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 10 : 12,
        opacity: item.isResolved ? 0.75 : 1,
        transition: 'opacity 150ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar
            src={item.author.avatarUrl}
            initials={getInitials(item.author.fullName)}
            color={seedColor(item.authorId)}
            size={compact ? 34 : 36}
          />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.author.fullName}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              {relativeTime(item.createdAt)}
              {item.isPinned && (
                <>
                  <span aria-hidden="true">·</span>
                  <Pin size={11} strokeWidth={1.5} aria-hidden="true" />
                  Pinned
                </>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 6, flexShrink: 0 }}>
          <TypeBadge type={item.type} />
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="Post options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="lf-menu-trigger"
              style={{
                width: compact ? 34 : 28,
                height: compact ? 34 : 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: menuOpen ? 'var(--surface-raised)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: menuOpen ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}
            >
              <MoreHorizontal size={16} strokeWidth={1.5} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: compact ? 38 : 32,
                  right: 0,
                  zIndex: 60,
                  minWidth: 184,
                  padding: 5,
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--surface-raised)',
                  border: '0.5px solid var(--border-hover)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                {menu.map(({ label, icon: Icon, danger, onSelect }) => (
                  <button
                    key={label}
                    type="button"
                    role="menuitem"
                    className="lf-menu-item"
                    onClick={() => {
                      setMenuOpen(false)
                      onSelect()
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '9px 10px',
                      borderRadius: 'var(--r-sm)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                      color: danger ? 'var(--uc-red)' : 'var(--text-primary)',
                    }}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.itemName}</p>
        {item.description && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{item.description}</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <MapPin size={12} strokeWidth={1.5} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.locationDetail}</span>
      </div>

      {item.imageUrls.length > 0 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {item.imageUrls.slice(0, 3).map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label={`Open photo ${index + 1} of ${item.itemName}`}
              style={{ position: 'relative', width: 72, height: 72, padding: 0, borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '0.5px solid var(--border-default)', flexShrink: 0, cursor: 'zoom-in', background: 'var(--surface-raised)' }}
            >
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {index === 2 && item.imageUrls.length > 3 && (
                <span style={{ position: 'absolute', inset: 0, background: 'var(--overlay-media)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  +{item.imageUrls.length - 3}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {item.isResolved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--uc-mint-bg)', border: '0.5px solid var(--uc-mint-bdr)', borderRadius: 'var(--r-md)' }}>
          <CheckCircle2 size={13} strokeWidth={1.5} color="var(--uc-mint)" />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--uc-mint)' }}>Resolved</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          aria-expanded={showContact}
          onClick={() => setShowContact((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minHeight: buttonHeight,
            padding: buttonPadding,
            fontSize: 13,
            fontFamily: 'inherit',
            background: showContact ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
            border: `0.5px solid ${showContact ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
            borderRadius: 'var(--r-pill)',
            color: showContact ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background 150ms, color 150ms, border-color 150ms',
          }}
        >
          <Phone size={12} strokeWidth={1.5} />
          Contact
        </button>

        {canResolve && (
          <button
            type="button"
            onClick={() => resolve.mutate(true)}
            disabled={resolve.isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: buttonHeight,
              padding: buttonPadding,
              fontSize: 13,
              fontFamily: 'inherit',
              background: 'var(--uc-mint-bg)',
              border: '0.5px solid var(--uc-mint-bdr)',
              borderRadius: 'var(--r-pill)',
              color: 'var(--uc-mint)',
              cursor: resolve.isPending ? 'default' : 'pointer',
              opacity: resolve.isPending ? 0.6 : 1,
            }}
          >
            <CheckCircle2 size={12} strokeWidth={1.5} />
            {resolve.isPending ? 'Resolving…' : compact ? 'Resolve' : 'Mark as resolved'}
          </button>
        )}
      </div>

      {showContact && (
        <div style={{ padding: compact ? '10px 12px' : '10px 14px', background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
          {item.contactInfo}
        </div>
      )}

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="lost_found"
        targetId={item.id}
        targetLabel={`“${item.itemName}”`}
      />

      {lightboxIndex !== null && (
        <ImageLightbox images={item.imageUrls} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  )
}
