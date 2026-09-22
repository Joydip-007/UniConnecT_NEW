import { useState } from 'react'
import { ChevronRight, Link2, Mail, MessageSquare, Rss, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useShareActions } from '@/features/share/hooks/useShareActions'
import type { Group } from '../types'

interface ShareGroupModalProps {
  group: Pick<Group, 'id' | 'name'>
  onClose: () => void
}

export function ShareGroupModal({ group, onClose }: ShareGroupModalProps) {
  const { url, shareToFeed, shareViaMessage, shareToGroup, shareByEmail } = useShareActions('group', group.id, group.name)
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const targets: { icon: LucideIcon; label: string; onClick: () => void }[] = [
    { icon: Rss, label: 'Share to your feed', onClick: () => { onClose(); void shareToFeed() } },
    { icon: MessageSquare, label: 'Send in a message', onClick: () => { onClose(); void shareViaMessage() } },
    { icon: Users, label: 'Share to a group', onClick: () => { onClose(); void shareToGroup() } },
    { icon: Mail, label: 'Share by email', onClick: () => { onClose(); shareByEmail() } },
  ]

  return (
    <Modal isOpen onClose={onClose} title="Share this group" maxWidth={440} sheet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)' }}>
            Group link
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 8px 8px 12px',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <Link2 size={13} strokeWidth={1.5} color="var(--text-tertiary)" aria-hidden />
            <span
              data-testid="share-group-url"
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {url}
            </span>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="press-feedback"
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--on-accent)',
                background: copied ? 'var(--uc-mint)' : 'var(--uc-indigo)',
                border: 'none',
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
                transition: 'background-color 150ms',
              }}
            >
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {targets.map(({ icon: Icon, label, onClick }, i) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="row-hover-bg"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 8px',
                background: 'transparent',
                border: 'none',
                borderTop: i === 0 ? 'none' : '0.5px solid var(--border-default)',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 400,
              }}
            >
              <Icon size={15} strokeWidth={1.5} color="var(--text-secondary)" aria-hidden />
              <span style={{ flex: 1 }}>{label}</span>
              <ChevronRight size={14} strokeWidth={1.5} color="var(--text-tertiary)" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
