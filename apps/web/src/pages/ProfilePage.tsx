import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { publicUserProfileSchema } from '@uniconnect/shared'
import type { PublicUserProfile } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import {
  AboutPanel,
  BadgesPanel,
  EditProfileModal,
  PostsPanel,
  ProfileHeader,
  ProfileTabs,
} from '@/features/profile'
import type { ProfileTab } from '@/features/profile'

function SkeletonProfile() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
        }}
      >
        <div style={{ height: 150, background: 'var(--surface-raised)' }} />
        <div style={{ padding: '46px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{ height: 16, width: '40%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }}
          />
          <div
            style={{ height: 13, width: '60%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }}
          />
          <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 32,
                  width: 64,
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--r-sm)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProfileErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <AlertCircle size={28} strokeWidth={1.5} color="var(--uc-red)" />
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
        We couldn't load this profile
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-secondary)',
          maxWidth: 360,
          lineHeight: 1.6,
        }}
      >
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 6,
          padding: '7px 14px',
          background: 'transparent',
          border: '0.5px solid var(--border-hover)',
          borderRadius: 'var(--r-pill)',
          color: 'var(--text-primary)',
          fontSize: 13,
          fontWeight: 400,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Try again
      </button>
    </div>
  )
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const authUser = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<ProfileTab>('about')
  const [editOpen, setEditOpen] = useState(false)

  const { data: user, isLoading, isError, error, refetch } = useQuery<PublicUserProfile>({
    queryKey: ['user', id],
    queryFn: async () => {
      const r = await api.get<{ data: unknown }>(`/users/${id}`)
      const parsed = publicUserProfileSchema.safeParse(r.data.data)
      if (!parsed.success) {
        throw new Error('Unexpected response shape from the server')
      }
      return parsed.data
    },
    enabled: !!id,
    retry: 1,
  })

  const isOwnProfile = authUser?.id === id

  if (isLoading) return <SkeletonProfile />

  if (isError || !user) {
    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while loading this profile.'
    return <ProfileErrorCard message={message} onRetry={() => refetch()} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ProfileHeader
        user={user}
        isOwnProfile={isOwnProfile}
        onEdit={() => setEditOpen(true)}
      />

      <ProfileTabs
        active={activeTab}
        postsCount={user.stats.posts}
        onChange={setActiveTab}
      />

      {activeTab === 'about' && <AboutPanel user={user} isOwnProfile={isOwnProfile} />}
      {activeTab === 'posts' && <PostsPanel userId={user.id} isOwnProfile={isOwnProfile} />}
      {activeTab === 'badges' && <BadgesPanel isOwnProfile={isOwnProfile} />}

      {editOpen && <EditProfileModal onClose={() => setEditOpen(false)} />}
    </div>
  )
}
