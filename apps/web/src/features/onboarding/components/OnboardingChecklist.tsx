import { useNavigate } from 'react-router-dom'
import { Camera, CheckCircle2, Circle, FileText, PenLine, UserPlus, X, type LucideIcon } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from '@/router/paths'
import { avatarColor, getInitials } from '@/utils/avatar'
import { ConnectButton } from '@/features/connections'
import {
  useOnboardingDismissed,
  useOnboardingSuggestions,
  useProfileProgress,
  type SuggestedPerson,
} from '../hooks/useOnboarding'

interface Step {
  key: string
  label: string
  icon: LucideIcon
  done: boolean
  cta: string
  onClick: () => void
}

/**
 * First-run checklist shown at the top of the feed. Unlike the desktop-only
 * right-rail progress widget, this is mobile-visible, actionable (each step
 * deep-links to the gap), dismissible, and auto-hides once everything is done.
 */
export function OnboardingChecklist() {
  const navigate = useNavigate()
  const myId = useAuthStore((s) => s.user?.id)
  const { dismissed, dismiss } = useOnboardingDismissed()
  const { data: progress } = useProfileProgress()

  const goToProfile = () => myId && navigate(PATHS.PROFILE.replace(':id', myId))

  const steps: Step[] = progress
    ? [
        { key: 'avatar', label: 'Add a profile photo', icon: Camera, done: progress.hasAvatar, cta: 'Add', onClick: goToProfile },
        { key: 'headline', label: 'Add a headline', icon: PenLine, done: progress.hasHeadline, cta: 'Add', onClick: goToProfile },
        { key: 'bio', label: 'Write a short bio', icon: PenLine, done: progress.hasBio, cta: 'Write', onClick: goToProfile },
        { key: 'post', label: 'Share your first post', icon: FileText, done: progress.hasMadePost, cta: 'Post', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        { key: 'connect', label: 'Connect with 3 people', icon: UserPlus, done: progress.connectionCount >= 3, cta: 'Find', onClick: () => navigate(PATHS.EXPLORE + '?type=people') },
      ]
    : []

  const completedCount = steps.filter((s) => s.done).length
  const allDone = steps.length > 0 && completedCount === steps.length
  const needsConnections = progress != null && progress.connectionCount < 3

  // Hidden when dismissed, before data loads, or once everything is complete.
  if (dismissed || !progress || allDone) return null

  const pct = Math.round((completedCount / steps.length) * 100)

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            Welcome to UniConnecT
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
            Finish setting up to get the most from your campus network.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss getting started"
          className="press-feedback row-hover-bg"
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--r-sm)',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--text-tertiary)',
            flexShrink: 0,
          }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Progress meter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
        <div style={{ flex: 1, height: 6, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'var(--uc-orange)',
              borderRadius: 'var(--r-pill)',
              transition: 'width 300ms cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          />
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', flexShrink: 0 }}>
          {completedCount}/{steps.length}
        </span>
      </div>

      {/* Steps */}
      <div>
        {steps.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
      </div>

      {/* Inline suggestions when the connect step is still open */}
      {needsConnections && <InlineSuggestions />}
    </div>
  )
}

function StepRow({ step }: { step: Step }) {
  const Icon = step.done ? CheckCircle2 : Circle
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderTop: '0.5px solid var(--border-default)',
      }}
    >
      <Icon size={16} strokeWidth={1.5} style={{ color: step.done ? 'var(--uc-mint)' : 'var(--text-tertiary)', flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          fontSize: 14,
          color: step.done ? 'var(--text-tertiary)' : 'var(--text-primary)',
          textDecoration: step.done ? 'line-through' : 'none',
        }}
      >
        {step.label}
      </span>
      {!step.done && (
        <button
          type="button"
          onClick={step.onClick}
          className="press-feedback"
          style={{
            background: 'var(--uc-indigo-bg)',
            border: '0.5px solid var(--uc-indigo-bdr)',
            borderRadius: 'var(--r-pill)',
            color: 'var(--uc-indigo-l)',
            fontSize: 12,
            fontWeight: 500,
            padding: '4px 12px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {step.cta}
        </button>
      )}
    </div>
  )
}

function InlineSuggestions() {
  const { data: people } = useOnboardingSuggestions(true)
  if (!people || people.length === 0) return null

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid var(--border-default)' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
        People you may know
      </div>
      {people.map((person, i) => (
        <SuggestionRow key={person.id} person={person} isLast={i === people.length - 1} />
      ))}
    </div>
  )
}

function SuggestionRow({ person, isLast }: { person: SuggestedPerson; isLast: boolean }) {
  const navigate = useNavigate()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)',
      }}
    >
      <button
        type="button"
        onClick={() => navigate(PATHS.PROFILE.replace(':id', person.id))}
        aria-label={`View ${person.profile.fullName}'s profile`}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
      >
        <Avatar initials={getInitials(person.profile.fullName)} color={avatarColor(person.id)} size={36} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {person.profile.fullName}
        </div>
        {person.profile.department && (
          <Badge variant="dept" className="mt-0.5">{person.profile.department}</Badge>
        )}
      </div>
      <ConnectButton
        targetUserId={person.id}
        targetName={person.profile.fullName}
        connectionStatus={person.connectionStatus ?? 'none'}
        connectionId={person.connectionId ?? null}
        size="sm"
      />
    </div>
  )
}
