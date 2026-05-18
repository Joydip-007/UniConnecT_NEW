import { useState } from 'react'
import { CheckCircle2, MapPin, Phone } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { getInitials, relativeTime, seedColor } from '../constants'
import { useResolveItem } from '../hooks/useResolveItem'
import type { LostFoundItem } from '../types'
import { TypeBadge } from './TypeBadge'

interface LostFoundCardProps {
  item: LostFoundItem
  currentUserId: string | undefined
}

export function LostFoundCard({ item, currentUserId }: LostFoundCardProps) {
  const [showContact, setShowContact] = useState(false)
  const isOwn = currentUserId === item.authorId
  const resolveMutation = useResolveItem(item.id)

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: `0.5px solid ${item.isResolved ? 'rgba(16,185,129,0.18)' : 'var(--border-default)'}`,
        borderRadius: 'var(--r-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        opacity: item.isResolved ? 0.75 : 1,
        transition: 'opacity 150ms',
      }}
    >
      {/* Header: avatar + author + type badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {item.author.avatarUrl ? (
            <img
              src={item.author.avatarUrl}
              alt={item.author.fullName}
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <Avatar
              initials={getInitials(item.author.fullName)}
              color={seedColor(item.authorId)}
              size={36}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.author.fullName}
            </p>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {relativeTime(item.createdAt)}
            </p>
          </div>
        </div>
        <TypeBadge type={item.type} />
      </div>

      {/* Item name + description */}
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {item.itemName}
        </p>
        {item.description && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
            }}
          >
            {item.description}
          </p>
        )}
      </div>

      {/* Location */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <MapPin size={12} strokeWidth={1.5} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
          {item.locationDetail}
        </span>
      </div>

      {/* Image thumbnails */}
      {item.imageUrls.length > 0 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {item.imageUrls.slice(0, 3).map((url, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                width: 72,
                height: 72,
                borderRadius: 'var(--r-sm)',
                overflow: 'hidden',
                border: '0.5px solid var(--border-default)',
                flexShrink: 0,
              }}
            >
              <img
                src={url}
                alt={`Photo ${i + 1} of ${item.itemName}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {i === 2 && item.imageUrls.length > 3 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--overlay-media)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                  }}
                >
                  +{item.imageUrls.length - 3}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolved banner */}
      {item.isResolved && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'var(--uc-mint-bg)',
            border: '0.5px solid var(--uc-mint-bdr)',
            borderRadius: 'var(--r-md)',
          }}
        >
          <CheckCircle2 size={13} strokeWidth={1.5} color="var(--uc-mint)" />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--uc-mint)' }}>Resolved</span>
        </div>
      )}

      {/* Actions row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setShowContact((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 400,
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

        {isOwn && !item.isResolved && (
          <button
            type="button"
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 400,
              background: 'var(--uc-mint-bg)',
              border: '0.5px solid var(--uc-mint-bdr)',
              borderRadius: 'var(--r-pill)',
              color: 'var(--uc-mint)',
              cursor: resolveMutation.isPending ? 'default' : 'pointer',
              opacity: resolveMutation.isPending ? 0.6 : 1,
              transition: 'opacity 150ms',
            }}
          >
            <CheckCircle2 size={12} strokeWidth={1.5} />
            {resolveMutation.isPending ? 'Resolving…' : 'Mark as resolved'}
          </button>
        )}
      </div>

      {/* Contact info reveal */}
      {showContact && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-primary)',
            lineHeight: 1.55,
          }}
        >
          {item.contactInfo}
        </div>
      )}
    </div>
  )
}
