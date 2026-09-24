import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'
import type { GroupSearchResult } from '../types'

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
  group: GroupSearchResult
}

export function GroupResultCard({ group }: Props) {
  const [member, setMember] = useState(group.isMember)
  const [count, setCount] = useState(group.memberCount)
  const qc = useQueryClient()

  const { mutate: toggleMembership, isPending } = useMutation({
    mutationFn: () =>
      member ? api.delete(`/groups/${group.id}/join`) : api.post(`/groups/${group.id}/join`),
    onMutate: () => {
      setMember((m) => !m)
      setCount((c) => (member ? c - 1 : c + 1))
    },
    onError: () => {
      setMember((m) => !m)
      setCount((c) => (member ? c + 1 : c - 1))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['search', 'groups'] })
    },
  })

  const color = seedColor(group.id)
  const initials = getInitials(group.name)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <Link
        to={`/groups/${group.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flex: 1,
          minWidth: 0,
          textDecoration: 'none',
        }}
      >
        <Avatar src={group.avatarUrl} initials={initials} color={color} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {group.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
            {group.type} · {count} members
          </div>
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.stopPropagation()
          toggleMembership()
        }}
        disabled={isPending}
        style={{
          padding: '4px 12px',
          borderRadius: 'var(--r-pill)',
          border: '0.5px solid var(--border-default)',
          background: member ? 'var(--surface-raised)' : 'var(--uc-indigo)',
          color: member ? 'var(--text-primary)' : 'var(--uc-indigo-xl)',
          fontSize: 12,
          fontWeight: 500,
          cursor: isPending ? 'default' : 'pointer',
          opacity: isPending ? 0.6 : 1,
          flexShrink: 0,
          marginLeft: 10,
        }}
      >
        {member ? 'Joined' : 'Join'}
      </button>
    </div>
  )
}
