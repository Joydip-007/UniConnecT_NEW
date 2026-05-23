import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'
import { avatarColor, getInitials } from '@/utils/avatar'
import type { UserSuggestion } from '../types'

interface Props {
  person: UserSuggestion
}

export function PersonSuggestionCard({ person }: Props) {
  const [following, setFollowing] = useState(person.isFollowing)
  const qc = useQueryClient()

  const { mutate: toggleFollow, isPending } = useMutation({
    mutationFn: () =>
      following ? api.delete(`/users/${person.id}/follow`) : api.post(`/users/${person.id}/follow`),
    onMutate: () => setFollowing((f) => !f),
    onError: () => setFollowing((f) => !f),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['explore', 'discovery'] }),
  })

  return (
    <div
      style={{
        flexShrink: 0,
        width: 148,
        scrollSnapAlign: 'start',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Link
        to={`/profile/${person.id}`}
        style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
      >
        <Avatar initials={getInitials(person.fullName)} color={avatarColor(person.id)} size={44} />
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {person.fullName}
          </div>
          {(person.headline || person.department) && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              {person.headline ?? person.department}
            </div>
          )}
        </div>
      </Link>
      <button
        onClick={() => toggleFollow()}
        disabled={isPending}
        style={{
          width: '100%',
          padding: '5px 0',
          borderRadius: 'var(--r-pill)',
          border: '0.5px solid var(--border-default)',
          background: following ? 'var(--surface-raised)' : 'var(--uc-indigo)',
          color: following ? 'var(--text-primary)' : 'var(--uc-indigo-xl)',
          fontSize: 12,
          fontWeight: 500,
          cursor: isPending ? 'default' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  )
}
