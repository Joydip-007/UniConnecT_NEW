import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Users, Lock, Sparkles, FlaskConical, GraduationCap, Layers } from 'lucide-react'
import { api } from '@/lib/axios'
import { GhostBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'

interface PendingRequester {
  userId: string
  fullName: string
  avatarUrl: string | null
}

interface AdminGroupItem {
  id: string
  name: string
  description: string
  type: string
  isPrivate: boolean
  memberCount: number
  pendingRequestCount: number
  pendingRequesters: PendingRequester[]
  createdAt: string
}

interface GroupsSummary {
  totalGroups: number
  privateGroups: number
  totalMembers: number
  pendingRequests: number
  createdThisWeek: number
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  summary: GroupsSummary
}

const LIMIT = 20

const TYPE_ICON: Record<string, typeof Building2> = {
  department: Building2,
  club: Sparkles,
  batch: GraduationCap,
  research: FlaskConical,
  interest: Layers,
  other: Users,
}

/**
 * One tone pair per group type, so a grid of six cards reads as six things rather than
 * one block. Always a pair — the glyph colour and its tile background are designed
 * against each other, and picking them apart is how text lands on a ground it was
 * never checked against.
 */
const TYPE_TONE: Record<string, { color: string; bg: string }> = {
  department: { color: 'var(--uc-indigo-l)', bg: 'var(--uc-indigo-bg)' },
  club: { color: 'var(--uc-cyan)', bg: 'var(--uc-cyan-bg)' },
  batch: { color: 'var(--uc-amber-l)', bg: 'var(--uc-amber-bg)' },
  research: { color: 'var(--uc-mint)', bg: 'var(--uc-mint-bg)' },
  interest: { color: 'var(--uc-orange-l)', bg: 'var(--uc-orange-bg)' },
  other: { color: 'var(--text-secondary)', bg: 'var(--surface-raised)' },
}

/**
 * What a member sees when they try to join. `is_private` is the only column that
 * exists, so Approval and Closed are one state today — the label says Approval, which
 * is what a private group actually does when someone asks to join.
 */
function privacyLabel(isPrivate: boolean): string {
  return isPrivate ? 'Approval' : 'Open'
}

export function GroupsTab() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<Paginated<AdminGroupItem>>({
    queryKey: ['admin', 'groups', page],
    queryFn: () =>
      api
        .get<{ data: Paginated<AdminGroupItem> }>('/admin/groups', { params: { page, limit: LIMIT } })
        .then((r) => ({ ...r.data.data, limit: LIMIT })),
  })

  if (isLoading || !data) return <SkeletonGrid />

  const totalPages = Math.max(1, Math.ceil(data.total / LIMIT))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GroupActivityPanel summary={data.summary} />

      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
        {data.total.toLocaleString()} {data.total === 1 ? 'group' : 'groups'} across the university
      </p>

      {data.items.length === 0 ? (
        <div style={{
          background: 'var(--surface-card)', border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)', padding: '56px 24px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 12, textAlign: 'center',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--surface-raised)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)',
          }}>
            <Users size={20} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>No groups yet</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {data.items.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
              <GhostBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</GhostBtn>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <GhostBtn disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</GhostBtn>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function GroupActivityPanel({ summary }: { summary: GroupsSummary }) {
  const tiles: { label: string; value: string; sub: string }[] = [
    { label: 'Total groups', value: summary.totalGroups.toLocaleString(), sub: `${summary.privateGroups} private` },
    { label: 'Total members', value: summary.totalMembers.toLocaleString(), sub: 'across all groups' },
    { label: 'Pending requests', value: summary.pendingRequests.toLocaleString(), sub: 'awaiting review' },
    { label: 'New this week', value: summary.createdThisWeek.toLocaleString(), sub: 'groups created' },
  ]

  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      display: 'flex',
      overflow: 'hidden',
    }}>
      {tiles.map((t, i) => (
        <div key={t.label} style={{
          flex: '1 1 0',
          minWidth: 100,
          padding: '16px 18px',
          borderLeft: i > 0 ? '0.5px solid var(--border-default)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em' }}>
            {t.label}
          </span>
          <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
            {t.value}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.sub}</span>
        </div>
      ))}
    </div>
  )
}

function PendingRequesterStack({ requesters, total }: { requesters: PendingRequester[]; total: number }) {
  if (requesters.length === 0) return null
  const overflow = total - requesters.length

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {requesters.map((r, i) => (
        <div
          key={r.userId}
          title={r.fullName}
          style={{
            marginLeft: i === 0 ? 0 : -8,
            border: '2px solid var(--surface-card)',
            borderRadius: '50%',
            zIndex: requesters.length - i,
          }}
        >
          <Avatar initials={getInitials(r.fullName)} color={avatarColor(r.userId)} size={22} src={r.avatarUrl} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            marginLeft: -8,
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '2px solid var(--surface-card)',
            background: 'var(--surface-raised)',
            color: 'var(--text-tertiary)',
            fontSize: 10,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

function GroupCard({ group }: { group: AdminGroupItem }) {
  const Icon = TYPE_ICON[group.type] ?? Users
  const tone = TYPE_TONE[group.type] ?? TYPE_TONE.other
  return (
    <article style={{
      background: 'var(--surface-card)', border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{
          width: 44, height: 44, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0, background: tone.bg, color: tone.color,
        }}>
          <Icon size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{group.name}</span>
            {group.isPrivate && <Lock size={13} style={{ color: 'var(--text-tertiary)' }} />}
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {group.memberCount.toLocaleString()} members · {privacyLabel(group.isPrivate)}
          </p>
        </div>
      </div>
      <p style={{
        margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {group.description}
      </p>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '0.5px solid var(--border-default)',
      }}>
        <PendingRequesterStack requesters={group.pendingRequesters} total={group.pendingRequestCount} />
        <span style={{
          fontSize: 12, fontWeight: 500, flex: 1, minWidth: 0,
          color: group.pendingRequestCount > 0 ? 'var(--uc-orange-l)' : 'var(--text-tertiary)',
        }}>
          {group.pendingRequestCount > 0 ? `${group.pendingRequestCount} pending requests` : 'No pending requests'}
        </span>
        <Link
          to={PATHS.GROUP_DETAIL.replace(':id', group.id)}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--r-pill)',
            border: '0.5px solid var(--uc-indigo-bdr)', background: 'var(--uc-indigo-bg)',
            color: 'var(--uc-indigo-xl)', textDecoration: 'none', flexShrink: 0,
          }}
        >
          Manage
        </Link>
      </div>
    </article>
  )
}

function SkeletonGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="admin-skeleton-card" style={{ height: 140 }} />
      ))}
    </div>
  )
}
