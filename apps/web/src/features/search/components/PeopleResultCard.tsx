import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'
import { highlightMatch } from '@/utils/highlightMatch'
import type { UserSearchResult } from '../types'

const AVATAR_PALETTE = ['var(--uc-indigo)', 'var(--uc-orange)', 'var(--uc-cyan)', 'var(--uc-mint)']

function seedColor(id: string): string {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]!
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

interface Props {
  person: UserSearchResult
  query: string
}

export function PeopleResultCard({ person, query }: Props) {
  const [following, setFollowing] = useState(person.isFollowing)
  const qc = useQueryClient()

  const { mutate: toggleFollow, isPending } = useMutation({
    mutationFn: () =>
      following ? api.delete(`/users/${person.id}/follow`) : api.post(`/users/${person.id}/follow`),
    onMutate: () => setFollowing((f) => !f),
    onError: () => setFollowing((f) => !f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['search', 'people'] })
    },
  })

  const color = seedColor(person.id)
  const initials = getInitials(person.fullName)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <Avatar initials={initials} color={color} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {highlightMatch(person.fullName, query)}
        </div>
        {(person.headline || person.department) && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
            {person.headline ?? person.department}
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          toggleFollow()
        }}
        disabled={isPending}
        style={{
          padding: '4px 12px',
          borderRadius: 'var(--r-pill)',
          border: '0.5px solid var(--border-default)',
          background: following ? 'var(--surface-raised)' : 'var(--uc-indigo)',
          color: following ? 'var(--text-primary)' : 'var(--uc-indigo-xl)',
          fontSize: 12,
          fontWeight: 500,
          cursor: isPending ? 'default' : 'pointer',
          opacity: isPending ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  )
}
