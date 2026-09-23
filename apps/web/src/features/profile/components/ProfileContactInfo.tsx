import { Code2, ExternalLink, Globe, Link2, Lock, Mail, Pencil, Phone } from 'lucide-react'
import type { PublicUserProfile } from '@uniconnect/shared'
import type { SectionLock } from '../sectionLock'

interface Props {
  user: PublicUserProfile
  isOwnProfile: boolean
  lock: SectionLock
  onEdit: () => void
}

function InfoRow({
  icon,
  value,
  href,
}: {
  icon: React.ReactNode
  value: string
  href?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'var(--text-tertiary)', lineHeight: 0, flexShrink: 0 }}>{icon}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--uc-indigo-xl)',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.5,
            wordBreak: 'break-all',
          }}
        >
          {value.replace(/^https?:\/\//, '')}
          <ExternalLink size={11} strokeWidth={1.5} style={{ flexShrink: 0 }} />
        </a>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {value}
        </span>
      )}
    </div>
  )
}

export function ProfileContactInfo({ user, isOwnProfile, lock, onEdit }: Props) {
  if (lock) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Lock size={16} strokeWidth={1.5} color="var(--text-tertiary)" />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          {lock === 'private' ? 'Contact information is private' : 'Connect to see contact information'}
        </p>
      </div>
    )
  }

  const p = user.profile
  const rows: Array<{ icon: React.ReactNode; value: string; href?: string }> = []

  if (user.email) {
    rows.push({ icon: <Mail size={14} strokeWidth={1.5} />, value: user.email })
  }

  if (p.phone) {
    rows.push({ icon: <Phone size={14} strokeWidth={1.5} />, value: p.phone, href: `tel:${p.phone}` })
  }

  if (p.linkedinUrl) {
    rows.push({
      icon: <Link2 size={14} strokeWidth={1.5} />,
      value: p.linkedinUrl,
      href: p.linkedinUrl,
    })
  }

  if (p.websiteUrl) {
    rows.push({
      icon: <Globe size={14} strokeWidth={1.5} />,
      value: p.websiteUrl,
      href: p.websiteUrl,
    })
  }

  if (p.githubUrl) {
    rows.push({
      icon: <Code2 size={14} strokeWidth={1.5} />,
      value: p.githubUrl,
      href: p.githubUrl,
    })
  }

  if (p.portfolioUrl) {
    rows.push({
      icon: <ExternalLink size={14} strokeWidth={1.5} />,
      value: p.portfolioUrl,
      href: p.portfolioUrl,
    })
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
          Contact info
        </span>
        {isOwnProfile && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit contact info"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-tertiary)',
              lineHeight: 0,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <Pencil size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row, idx) => (
          <InfoRow key={idx} icon={row.icon} value={row.value} href={row.href} />
        ))}
      </div>
    </div>
  )
}
