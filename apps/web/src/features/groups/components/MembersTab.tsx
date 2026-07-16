import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Search, UserPlus } from 'lucide-react'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { GhostBtn } from '@/components/Button'
import { MemberRoleTag } from './MemberRoleTag'
import { InviteMemberModal } from './InviteMemberModal'
import type { Group, GroupMember } from '../types'

interface MembersPage {
  items: GroupMember[]
  hasMore: boolean
  page: number
}

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'member', label: 'Member' },
]

export function MembersTab({ group }: { group: Group }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const canInvite = !group.isSystem && (group.userRole === 'owner' || group.userRole === 'admin')

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery<MembersPage>({
    queryKey: ['groups', 'members', group.id, debounced, roleFilter],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: MembersPage }>(`/groups/${group.id}/members`, {
          params: {
            page: pageParam,
            ...(debounced ? { search: debounced } : {}),
            ...(roleFilter ? { role: roleFilter } : {}),
          },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const members = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
          }}
        >
          <Search size={13} strokeWidth={1.5} color="var(--text-tertiary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            aria-label="Search members"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 400,
            }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          style={{
            padding: '7px 10px',
            fontSize: 12,
            fontWeight: 400,
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            color: roleFilter ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {canInvite && (
          <GhostBtn onClick={() => setInviteOpen(true)} style={{ padding: '6px 14px', fontSize: 13 }}>
            <UserPlus size={13} strokeWidth={1.5} />
            Invite
          </GhostBtn>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonMember key={i} />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {debounced ? 'No matching members' : 'No members yet'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((member) => (
            <div
              key={member.id}
              style={{
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-lg)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Avatar src={member.avatarUrl} initials={getInitials(member.fullName)} color={seedColor(member.id)} size={40} />

              <div style={{ flex: 1, minWidth: 0 }}>
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
                  {member.fullName}
                </p>
                {(member.headline ?? member.department) && (
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: 12,
                      fontWeight: 400,
                      color: 'var(--text-tertiary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {member.headline ?? member.department}
                  </p>
                )}
              </div>

              <MemberRoleTag role={member.role} hideOwner={group.isSystem} />
            </div>
          ))}

          {isFetchingNextPage && (
            <>
              <SkeletonMember />
              <SkeletonMember />
            </>
          )}

          <div ref={sentinelRef} style={{ height: 1 }} />
        </div>
      )}

      {inviteOpen && <InviteMemberModal group={group} onClose={() => setInviteOpen(false)} />}
    </div>
  )
}

function SkeletonMember() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-raised)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 13, width: '40%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        <div style={{ height: 11, width: '28%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
      </div>
    </div>
  )
}
