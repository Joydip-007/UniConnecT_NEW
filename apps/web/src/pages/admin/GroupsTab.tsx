import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Users, Lock, Sparkles, FlaskConical, GraduationCap, Layers } from 'lucide-react'
import { api } from '@/lib/axios'
import { GhostBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'

interface AdminGroupItem {
  id: string
  name: string
  description: string
  type: string
  isPrivate: boolean
  memberCount: number
  pendingRequestCount: number
  createdAt: string
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
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

  if (data.items.length === 0) {
    return (
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
    )
  }

  const totalPages = Math.max(1, Math.ceil(data.total / LIMIT))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
        {data.total.toLocaleString()} {data.total === 1 ? 'group' : 'groups'} across the university
      </p>
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
    </div>
  )
}

function GroupCard({ group }: { group: AdminGroupItem }) {
  const Icon = TYPE_ICON[group.type] ?? Users
  return (
    <article style={{
      background: 'var(--surface-card)', border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{
          width: 44, height: 44, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0, background: 'var(--uc-indigo-bg)', color: 'var(--uc-indigo-l)',
        }}>
          <Icon size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{group.name}</span>
            {group.isPrivate && <Lock size={13} style={{ color: 'var(--text-tertiary)' }} />}
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {group.type} · {group.memberCount.toLocaleString()} members
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
            color: 'var(--uc-indigo-l)', textDecoration: 'none', flexShrink: 0,
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
