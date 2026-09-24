import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { formatDistanceToNowStrict, parseISO, isSameMonth, addMonths, format } from 'date-fns'
import type { UserRole } from '@uniconnect/shared'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useAuthStore } from '@/stores/authStore'
import { suggestionReason } from '../suggestionReason'
import { useDiscoveryJoinGroup, useDiscoveryRsvp } from '../hooks/useDiscoveryActions'
import { DiscoveryConnectButton } from './DiscoveryConnectButton'
import { useExploreLinkState } from '../hooks/useExploreLinkState'
import { useLockedLinkGuard } from '../hooks/useLockedLinkGuard'
import { alumniMeta, discoveryGroupNotice, type SeeAllKey } from '../cardHelpers'
import type { DiscoveryResult, EventSummary, GroupSummary } from '../types'

const TITLES: Record<SeeAllKey, string> = {
  trending: 'Trending posts',
  people: 'People you may know',
  groups: 'Active groups',
  events: 'Upcoming events',
  alumni: 'Featured alumni',
}

interface Props {
  section: SeeAllKey
  data: DiscoveryResult
  filter: string
  onFilterChange: (next: string) => void
  onBack: () => void
}

// ── Chips ────────────────────────────────────────────────────────────────────

function chipColors(active: boolean, idleBg: string): React.CSSProperties {
  return {
    background: active ? 'var(--uc-indigo-bg)' : idleBg,
    color: active ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
    border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
  }
}

const chipBase: React.CSSProperties = {
  minHeight: 32,
  padding: '0 13px',
  borderRadius: 'var(--r-pill)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
}

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label="Filter" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(value === o ? '' : o)}
          style={{ ...chipBase, ...chipColors(value === o, 'var(--surface-card)') }}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

/** Two-level chips: pick a facet (Department / Batch), then a value inside it. */
function ChipGroups({ groups, value, onChange }: { groups: { label: string; chips: string[] }[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(groups[0]?.label)
  if (groups.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {groups.map((g) => {
          const picked = g.chips.includes(value)
          const isOpen = g.label === open
          return (
            <button
              key={g.label}
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(g.label)}
              style={{
                ...chipBase,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: picked ? 'var(--uc-indigo-bg)' : isOpen ? 'var(--surface-hover)' : 'var(--surface-card)',
                color: picked ? 'var(--uc-indigo-l)' : isOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: `0.5px solid ${picked ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
              }}
            >
              {g.label}
            </button>
          )
        })}
      </div>
      {groups
        .filter((g) => g.label === open)
        .map((g) => (
          <div key={g.label} role="group" aria-label={g.label} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 2 }}>
            {g.chips.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={value === c}
                onClick={() => onChange(value === c ? '' : c)}
                style={{
                  minHeight: 28,
                  padding: '0 11px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: 12,
                  cursor: 'pointer',
                  ...chipColors(value === c, 'transparent'),
                }}
              >
                {c}
              </button>
            ))}
          </div>
        ))}
    </div>
  )
}

// ── Grid item ────────────────────────────────────────────────────────────────

const actionBase: React.CSSProperties = {
  flexShrink: 0,
  minHeight: 32,
  padding: '0 14px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 'var(--r-pill)',
  whiteSpace: 'nowrap',
}

function Item({ to, lead, title, subtitle, meta, action, locked, titleRole, subtitleRole }: {
  to: string
  /** Role badge before the title — the item *is* a person. */
  titleRole?: UserRole
  /** Role badge before the subtitle — it leads with the author's name. */
  subtitleRole?: UserRole
  /** When set, the item cannot be opened: clicking shows this instead of navigating. */
  locked?: string | null
  lead?: ReactNode
  title: string
  subtitle?: string | null
  meta?: string | null
  action?: ReactNode
}) {
  const linkState = useExploreLinkState()
  const guard = useLockedLinkGuard()
  return (
    <div
      className="explore-grid-item"
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '12px 14px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        minWidth: 0,
      }}
    >
      <Link to={to} state={linkState} onClick={guard(locked)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0, textDecoration: 'none' }}>
        {lead}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {titleRole && <RoleBadge role={titleRole} size={14} tipPlacement="below" />}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, minWidth: 0 }}>{title}</span>
          </div>
          {subtitle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {subtitleRole && <RoleBadge role={subtitleRole} size={12} />}
              <span>{subtitle}</span>
            </div>
          )}
          {meta && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{meta}</div>}
        </div>
      </Link>
      {action}
    </div>
  )
}

function SubSection({ label, count, hint, children }: { label?: string; count?: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</h3>
          {count && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{count}</span>}
          {hint && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{hint}</span>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>{children}</div>
    </div>
  )
}

// ── Actions (See-all variants, per the design) ───────────────────────────────

function GroupJoinMint({ group }: { group: GroupSummary }) {
  const { mutate, isPending } = useDiscoveryJoinGroup(group)
  const on = !!group.joined || group.requestPending
  const label = group.joined ? 'Joined' : group.requestPending ? 'Requested' : group.isPrivate ? 'Request' : 'Join'
  return (
    <button
      type="button"
      onClick={() => mutate()}
      disabled={isPending}
      aria-pressed={on}
      aria-label={`${label}: ${group.name}`}
      style={{
        ...actionBase,
        cursor: isPending ? 'default' : 'pointer',
        opacity: isPending ? 0.6 : 1,
        background: on ? 'var(--uc-mint-bg)' : 'var(--uc-mint)',
        color: on ? 'var(--uc-mint)' : 'var(--on-accent)',
        border: on ? '0.5px solid var(--uc-mint-bdr)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

function EventGoingButton({ event }: { event: EventSummary }) {
  const { mutate, isPending } = useDiscoveryRsvp(event)
  const going = event.myRsvp === 'going'
  return (
    <button
      type="button"
      onClick={() => mutate()}
      disabled={isPending}
      aria-pressed={going}
      aria-label={going ? `You're going to ${event.title}` : `RSVP going to ${event.title}`}
      style={{
        ...actionBase,
        cursor: isPending ? 'default' : 'pointer',
        opacity: isPending ? 0.6 : 1,
        background: going ? 'transparent' : 'var(--uc-indigo)',
        color: going ? 'var(--text-secondary)' : 'var(--on-accent)',
        border: going ? '0.5px solid var(--border-default)' : 'none',
      }}
    >
      Going
    </button>
  )
}

function DayCircle({ startsAt }: { startsAt: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--on-accent)',
        background: 'var(--uc-indigo)',
      }}
    >
      {format(parseISO(startsAt), 'dd')}
    </span>
  )
}

// ── Filters ──────────────────────────────────────────────────────────────────

const PEOPLE_CHIPS = ['Students', 'Alumni', 'Faculty', 'Same department']
const PEOPLE_ROLE: Record<string, string> = { Students: 'student', Alumni: 'alumni', Faculty: 'faculty' }
const GROUP_CHIPS = ['Departments', 'Clubs', 'Batches', 'Joined']
const GROUP_CHIP_TYPE: Record<string, string> = { Departments: 'department', Clubs: 'club', Batches: 'batch' }
const EVENT_CHIPS = ['This month', 'Next month', 'Going']
const ALUMNI_SPLIT_YEAR = 2020

function uniq(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort()
}

// ── View ─────────────────────────────────────────────────────────────────────

export function SeeAllView({ section, data, filter, onFilterChange, onBack }: Props) {
  const viewer = useAuthStore((s) => s.user?.profile)

  let chips: ReactNode = null
  let body: ReactNode = null
  let visible = 0

  if (section === 'trending') {
    visible = data.trendingPosts.length
    body = visible > 0 && (
      <SubSection>
        {data.trendingPosts.map((p) => (
          <Item
            key={p.id}
            to={`/feed/${p.id}`}
            title={p.content}
            subtitle={`${p.authorName} · ${formatDistanceToNowStrict(parseISO(p.createdAt), { addSuffix: true })}`}
            subtitleRole={p.authorRole}
            meta={`${p.reactionCount} reactions · ${p.commentCount} comments`}
          />
        ))}
      </SubSection>
    )
  }

  if (section === 'people') {
    const people = data.peopleSuggestions.filter((p) => {
      if (!filter) return true
      if (filter === 'Same department') return !!viewer?.department && p.department === viewer.department
      return p.role === PEOPLE_ROLE[filter]
    })
    visible = people.length
    chips = <Chips options={PEOPLE_CHIPS} value={filter} onChange={onFilterChange} />
    body = visible > 0 && (
      <SubSection>
        {people.map((p) => (
          <Item
            key={p.id}
            to={`/profile/${p.id}`}
            lead={<Avatar src={p.avatarUrl ?? undefined} initials={getInitials(p.fullName)} color={avatarColor(p.id)} size={36} />}
            title={p.fullName}
            titleRole={p.role}
            subtitle={p.headline ?? ([p.department, p.batchYear].filter(Boolean).join(' · ') || null)}
            meta={suggestionReason(p, viewer)}
            action={<DiscoveryConnectButton person={p} />}
          />
        ))}
      </SubSection>
    )
  }

  if (section === 'groups') {
    const groups = data.activeGroups.filter((g) => {
      if (!filter) return true
      if (filter === 'Joined') return !!g.joined
      return g.type === GROUP_CHIP_TYPE[filter]
    })
    const mine = groups.filter((g) => g.joined)
    const rest = groups.filter((g) => !g.joined)
    const plural = (n: number) => (n === 1 ? '1 group' : `${n} groups`)
    const renderGroup = (g: GroupSummary) => (
      <Item
        key={g.id}
        to={`/groups/${g.id}`}
        lead={<Avatar src={g.avatarUrl ?? undefined} initials={getInitials(g.name)} color={avatarColor(g.id)} size={36} />}
        title={g.name}
        subtitle={`${g.isPrivate ? 'Private · ' : ''}${g.memberCount.toLocaleString()} members`}
        meta={`${g.recentPostCount} posts this week`}
        action={<GroupJoinMint group={g} />}
        locked={discoveryGroupNotice(g)}
      />
    )
    const subsections = [
      { label: 'Your groups', hint: 'you are a member', items: mine },
      { label: 'Suggested for you', hint: 'from your department and batch', items: rest.slice(0, 2) },
      { label: 'Browse by type', hint: 'filter with the chips above', items: rest.slice(2) },
    ].filter((sec) => sec.items.length > 0)
    visible = groups.length
    chips = <Chips options={GROUP_CHIPS} value={filter} onChange={onFilterChange} />
    body = subsections.map((sec) => (
      <SubSection key={sec.label} label={sec.label} count={plural(sec.items.length)} hint={sec.hint}>
        {sec.items.map(renderGroup)}
      </SubSection>
    ))
  }

  if (section === 'events') {
    const now = new Date()
    const events = data.upcomingEvents.filter((e) => {
      const d = parseISO(e.startsAt)
      if (filter === 'This month') return isSameMonth(d, now)
      if (filter === 'Next month') return isSameMonth(d, addMonths(now, 1))
      if (filter === 'Going') return e.myRsvp === 'going'
      return true
    })
    visible = events.length
    chips = <Chips options={EVENT_CHIPS} value={filter} onChange={onFilterChange} />
    body = visible > 0 && (
      <SubSection>
        {events.map((e) => {
          const d = parseISO(e.startsAt)
          return (
            <Item
              key={e.id}
              to={`/events/${e.id}`}
              lead={<DayCircle startsAt={e.startsAt} />}
              title={e.title}
              subtitle={[format(d, 'EEE dd MMM').toUpperCase(), format(d, 'HH:mm'), e.location].filter(Boolean).join(' · ')}
              meta={`${e.rsvpCount} going`}
              action={<EventGoingButton event={e} />}
            />
          )
        })}
      </SubSection>
    )
  }

  if (section === 'alumni') {
    const years = data.featuredAlumni.map((a) => Number(a.batchYear)).filter((y) => Number.isFinite(y) && y > 0)
    const early = years.filter((y) => y < ALUMNI_SPLIT_YEAR)
    const batchChips = [
      ...(early.length ? [`Class of ${Math.min(...early)} to ${ALUMNI_SPLIT_YEAR - 1}`] : []),
      ...(years.some((y) => y >= ALUMNI_SPLIT_YEAR) ? [`Class of ${ALUMNI_SPLIT_YEAR} onward`] : []),
    ]
    const facets = [
      { label: 'Department', chips: uniq(data.featuredAlumni.map((a) => a.department)) },
      { label: 'Batch', chips: batchChips },
    ].filter((f) => f.chips.length > 0)
    const alumni = data.featuredAlumni.filter((a) => {
      if (!filter) return true
      const year = Number(a.batchYear)
      if (filter.endsWith(' onward')) return year >= ALUMNI_SPLIT_YEAR
      if (filter.startsWith('Class of ')) return year > 0 && year < ALUMNI_SPLIT_YEAR
      return a.department === filter
    })
    visible = alumni.length
    chips = <ChipGroups groups={facets} value={filter} onChange={onFilterChange} />
    body = visible > 0 && (
      <SubSection>
        {alumni.map((a) => (
          <Item
            key={a.id}
            to={`/profile/${a.id}`}
            lead={<Avatar src={a.avatarUrl ?? undefined} initials={getInitials(a.fullName)} color={avatarColor(a.id)} size={36} />}
            title={a.fullName}
            titleRole={a.role}
            subtitle={a.headline}
            meta={alumniMeta(a) || null}
            action={<DiscoveryConnectButton person={a} />}
          />
        ))}
      </SubSection>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          aria-label="Back to explore"
          onClick={onBack}
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <ArrowLeft size={15} aria-hidden="true" />
        </button>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{TITLES[section]}</h2>
        <span style={{ flex: 1 }} />
      </div>
      {chips}
      {body}
      {visible === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
          Nothing matches that filter.
        </div>
      )}
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', padding: '20px 0 0' }}>End of results</div>
    </div>
  )
}
