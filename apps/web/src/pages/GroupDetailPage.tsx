import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/axios'
import { GhostBtn } from '@/components/Button'
import { CollabTab, EventsTab, FeedTab, GroupHeader, MembersTab } from '@/features/groups'
import type { Group } from '@/features/groups'

type ActiveTab = 'feed' | 'events' | 'collaborations' | 'members'

const TABS: { value: ActiveTab; label: string }[] = [
  { value: 'feed', label: 'Feed' },
  { value: 'events', label: 'Events' },
  { value: 'collaborations', label: 'Collaborations' },
  { value: 'members', label: 'Members' },
]

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed')

  const { data: group, isLoading: groupLoading, isError } = useQuery<Group>({
    queryKey: ['groups', 'detail', id],
    queryFn: () => api.get<{ data: Group }>(`/groups/${id}`).then((r) => r.data.data),
    enabled: !!id,
  })

  if (isError) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Group not found
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
          This group may have been removed or you don't have access.
        </p>
        <GhostBtn onClick={() => navigate('/groups')}>Back to groups</GhostBtn>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        type="button"
        onClick={() => navigate('/groups')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-secondary)',
          alignSelf: 'flex-start',
          transition: 'color 150ms',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Groups
      </button>

      {groupLoading ? <SkeletonHeader /> : group && <GroupHeader group={group} />}

      <nav
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 6px',
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              style={{
                flex: 1,
                padding: '7px 0',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      {id && activeTab === 'feed' && <FeedTab groupId={id} />}
      {id && activeTab === 'events' && <EventsTab groupId={id} />}
      {id && group && activeTab === 'collaborations' && <CollabTab group={group} />}
      {id && group && activeTab === 'members' && <MembersTab group={group} />}
    </div>
  )
}

function SkeletonHeader() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: 120, background: 'var(--surface-raised)' }} />
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            marginTop: -28,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--surface-hover)',
            border: '3px solid var(--surface-card)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ height: 16, width: '45%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          <div style={{ height: 12, width: '25%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        </div>
      </div>
    </div>
  )
}
