import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { GhostBtn } from '@/components/Button'
import {
  EventsTab, FeedTab, GroupHeader, MembersTab,
  AnimatedTabBar, PinnedBanner,
  ResourcesTab, StudyToolsTab, JoinRequestsTab, AboutTab, AdminStatsTab,
  AcademicLMSTab,
  useJoinRequests,
  type TabDef,
} from '@/features/groups'
import type { Group } from '@/features/groups'

type ActiveTab = 'feed' | 'resources' | 'study-sessions' | 'members' | 'events' | 'about' | 'stats' | 'join-requests' | 'academic'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed')

  const { data: group, isLoading: groupLoading, isError } = useQuery<Group>({
    queryKey: ['groups', 'detail', id],
    queryFn: () => api.get<{ data: Group }>(`/groups/${id}`).then((r) => r.data.data),
    enabled: !!id,
  })

  // Pending join requests badge — only fetched when user is owner/admin
  const isAdmin = group?.userRole === 'owner' || group?.userRole === 'admin'
  const { data: joinRequestsData } = useJoinRequests(id ?? '', isAdmin)
  const pendingCount = isAdmin ? (joinRequestsData?.total ?? 0) : 0

  const userRole = group?.userRole ?? null
  const isModeratorOrAbove = !!(userRole && ['owner', 'admin', 'moderator'].includes(userRole))
  const canEditRules = userRole === 'owner' || userRole === 'admin'

  // Build tab list based on role
  const tabs: TabDef[] = [
    { value: 'feed', label: 'Feed' },
    { value: 'resources', label: 'Resources' },
    { value: 'study-sessions', label: 'Study sessions' },
    ...(group?.type === 'academic' ? [{ value: 'academic', label: 'Academic LMS' } as TabDef] : []),
    { value: 'members', label: 'Members' },
    { value: 'events', label: 'Events' },
    { value: 'about', label: 'About' },
    ...(isModeratorOrAbove ? [{ value: 'stats', label: 'Stats' } as TabDef] : []),
    ...(isAdmin
      ? [
          {
            value: 'join-requests',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                Join requests
                {pendingCount > 0 && (
                  <span style={{ padding: '1px 6px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--r-pill)', background: 'var(--uc-orange-bg)', color: 'var(--uc-orange-l)' }}>
                    {pendingCount}
                  </span>
                )}
              </span>
            ) as ReactNode,
          } as TabDef,
        ]
      : []),
  ]

  if (isError) {
    return (
      <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Group not found</p>
        <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>This group may have been removed or you don't have access.</p>
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

      {/* Pinned banner between header and tabs */}
      {group?.pinnedText && (
        <PinnedBanner
          text={group.pinnedText}
          pinnedBy={group.pinnedBy}
          canEdit={isModeratorOrAbove}
          onEdit={() => setActiveTab('about')}
        />
      )}

      {/* Animated tab bar */}
      <AnimatedTabBar
        tabs={tabs}
        active={activeTab}
        onChange={(v) => setActiveTab(v as ActiveTab)}
      />

      {/* Tab content */}
      <div>
        {id && activeTab === 'feed' && <FeedTab groupId={id} />}
        {id && activeTab === 'resources' && (
          <ResourcesTab groupId={id} userRole={userRole} currentUserId={user?.id} />
        )}
        {id && activeTab === 'study-sessions' && (
          <StudyToolsTab groupId={id} currentUserId={user?.id} userRole={userRole} groupType={group?.type} />
        )}
        {id && group?.type === 'academic' && activeTab === 'academic' && (
          <AcademicLMSTab groupId={id} isAdmin={isAdmin} />
        )}
        {id && group && activeTab === 'members' && <MembersTab group={group} />}
        {id && activeTab === 'events' && <EventsTab groupId={id} />}
        {id && group && activeTab === 'about' && <AboutTab groupId={id} rulesMd={group.rulesMd} canEdit={!!canEditRules} />}
        {id && isModeratorOrAbove && activeTab === 'stats' && <AdminStatsTab groupId={id} />}
        {id && isAdmin && activeTab === 'join-requests' && <JoinRequestsTab groupId={id} />}
      </div>
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
