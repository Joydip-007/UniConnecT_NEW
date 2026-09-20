import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Search, Users } from 'lucide-react'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { Modal } from '@/components/Modal'
import { MemberRoleTag } from './MemberRoleTag'
import type { Group, GroupMember } from '../types'

interface MembersPage {
  items: GroupMember[]
  hasMore: boolean
  page: number
}

/**
 * The members panel, routed at `/groups/:id?modal=members` — what the header's
 * avatar stack opens. It reads the same `['groups','members',…]` pages the Members
 * tab does, so the two never disagree; management (roles, removal, pending invites)
 * stays on the tab, which is the fuller surface.
 */
export function MembersPanel({
  group,
  onClose,
  onInvite,
}: {
  group: Group
  onClose: () => void
  /** Swaps this panel for the invite panel. Only passed when the viewer may invite. */
  onInvite?: () => void
}) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery<MembersPage>({
    queryKey: ['groups', 'members', group.id, debounced, ''],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: MembersPage }>(`/groups/${group.id}/members`, {
          params: { page: pageParam, ...(debounced ? { search: debounced } : {}) },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })

  const members = data?.pages.flatMap((p) => p.items) ?? []
  const countText = `${group.memberCount.toLocaleString()} ${group.memberCount === 1 ? 'member' : 'members'}`

  return (
    <Modal
      isOpen
      onClose={onClose}
      variant="panel"
      maxWidth={560}
      icon={<Users size={16} strokeWidth={1.5} />}
      title="Members"
      subtitle={`Everyone in ${group.name}.`}
      footer={
        <>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>{countText}</span>
          {onInvite && (
            <button
              type="button"
              onClick={onInvite}
              className="press-feedback"
              style={{
                minHeight: 34,
                padding: '0 16px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                borderRadius: 'var(--r-pill)',
                border: '0.5px solid var(--uc-indigo-bdr)',
                background: 'var(--uc-indigo-bg)',
                color: 'var(--uc-indigo-xl)',
                cursor: 'pointer',
              }}
            >
              Invite
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="press-feedback"
            style={{
              minHeight: 34,
              padding: '0 16px',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              borderRadius: 'var(--r-pill)',
              border: '0.5px solid var(--border-hover)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </>
      }
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          minHeight: 38,
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-pill)',
        }}
      >
        <Search size={15} strokeWidth={1.5} color="var(--text-tertiary)" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          aria-label="Search members"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'none',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            fontWeight: 400,
            fontFamily: 'inherit',
            color: 'var(--text-primary)',
          }}
        />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {isLoading ? (
          <EmptyText>Loading members…</EmptyText>
        ) : members.length === 0 ? (
          <EmptyText>{debounced ? `No members match “${debounced}”.` : 'No members yet.'}</EmptyText>
        ) : (
          members.map((m, i) => (
            <Link
              key={m.id}
              to={`/profile/${m.id}`}
              className="row-hover-bg"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '10px 8px',
                textDecoration: 'none',
                borderTop: i === 0 ? 'none' : '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-sm)',
              }}
            >
              <Avatar src={m.avatarUrl} initials={getInitials(m.fullName)} color={seedColor(m.id)} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{m.fullName}</p>
                {(m.headline || m.department) && (
                  <p
                    style={{
                      margin: '1px 0 0',
                      fontSize: 12,
                      fontWeight: 400,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.headline ?? m.department}
                  </p>
                )}
              </div>
              <MemberRoleTag role={m.role} />
            </Link>
          ))
        )}
        {hasNextPage && (
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            style={{
              alignSelf: 'center',
              margin: '10px 0 2px',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              borderRadius: 'var(--r-pill)',
              border: '0.5px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: isFetchingNextPage ? 'default' : 'pointer',
            }}
          >
            {isFetchingNextPage ? 'Loading…' : 'Show more'}
          </button>
        )}
      </div>
    </Modal>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, padding: '26px 12px', textAlign: 'center', fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
      {children}
    </p>
  )
}
