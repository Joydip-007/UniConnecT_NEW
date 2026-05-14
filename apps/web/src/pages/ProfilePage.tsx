import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award } from 'lucide-react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { EditProfileModal, FollowModal } from '@/features/profile'
import type { FollowMode } from '@/features/profile'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProfileUser {
  id: string
  role: 'student' | 'alumni' | 'staff' | 'admin'
  profile: {
    fullName: string
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
  }
  stats: {
    following: number
    followers: number
    posts: number
  }
  isFollowing: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  'var(--uc-indigo)',
  'var(--uc-orange)',
  'var(--uc-cyan)',
  'var(--uc-mint)',
]

function seedColor(id: string): string {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function roleBadgeVariant(role: ProfileUser['role']): 'dept' | 'alumni' | 'neutral' {
  if (role === 'student') return 'dept'
  if (role === 'alumni') return 'alumni'
  return 'neutral'
}

function roleLabel(role: ProfileUser['role']): string {
  if (role === 'staff') return 'Staff'
  if (role === 'admin') return 'Admin'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

// ── SkeletonProfile ────────────────────────────────────────────────────────────

function SkeletonProfile() {
  return (
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
              style={{ height: 32, width: 64, background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── BadgeGrid ──────────────────────────────────────────────────────────────────

function BadgeGrid() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 0',
        gap: 10,
      }}
    >
      <Award size={32} strokeWidth={1} color="var(--text-tertiary)" />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 400, color: 'var(--text-tertiary)' }}>
        No badges yet
      </p>
    </div>
  )
}

// ── PostsFeed ─────────────────────────────────────────────────────────────────

function PostsFeed() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 0',
        gap: 10,
      }}
    >
      <p style={{ margin: 0, fontSize: 14, fontWeight: 400, color: 'var(--text-tertiary)' }}>
        No posts yet
      </p>
    </div>
  )
}

// ── ProfilePage ────────────────────────────────────────────────────────────────

type Tab = 'posts' | 'badges'

const TABS: { label: string; value: Tab }[] = [
  { label: 'Posts', value: 'posts' },
  { label: 'Badges', value: 'badges' },
]

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const authUser = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('posts')

  const { data: user, isLoading } = useQuery<ProfileUser>({
    queryKey: ['user', id],
    queryFn: () =>
      api.get<{ data: ProfileUser }>(`/users/${id}`).then((r) => r.data.data),
    enabled: !!id,
  })

  const followMutation = useMutation({
    mutationFn: (isFollowing: boolean) =>
      isFollowing
        ? api.delete(`/users/${id}/follow`)
        : api.post(`/users/${id}/follow`),
    onSuccess: (_data, wasFollowing) => {
      queryClient.setQueryData<ProfileUser>(['user', id], (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          isFollowing: !wasFollowing,
          stats: {
            ...prev.stats,
            followers: prev.stats.followers + (wasFollowing ? -1 : 1),
          },
        }
      })
    },
  })

  const isOwnProfile = authUser?.id === id
  const [editOpen, setEditOpen] = useState(false)
  const [followModal, setFollowModal] = useState<FollowMode | null>(null)

  if (isLoading || !user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonProfile />
      </div>
    )
  }

  const avatarColor = seedColor(user.id)
  const fullName = user.profile.fullName

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Profile card */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Cover */}
        <div
          style={{
            height: 150,
            position: 'relative',
            background: 'var(--uc-indigo-bg)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.11) 1.5px, transparent 1.5px)',
              backgroundSize: '18px 18px',
            }}
          />
        </div>

        {/* Avatar + info */}
        <div style={{ position: 'relative', padding: '0 20px 20px' }}>
          {/* Avatar — overlaps cover by half */}
          <div
            style={{
              position: 'absolute',
              top: -30,
              left: 20,
              borderRadius: '50%',
              border: '3px solid var(--surface-card)',
              lineHeight: 0,
            }}
          >
            {user.profile.avatarUrl ? (
              <img
                src={user.profile.avatarUrl}
                alt={fullName}
                style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <Avatar initials={getInitials(fullName)} color={avatarColor} size={60} />
            )}
          </div>

          {/* Follow / edit button — top-right of info area */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
            {isOwnProfile ? (
              <GhostBtn onClick={() => setEditOpen(true)}>Edit profile</GhostBtn>
            ) : (
              <PrimaryBtn
                onClick={() => followMutation.mutate(user.isFollowing)}
                disabled={followMutation.isPending}
                style={
                  user.isFollowing
                    ? {
                        background: 'transparent',
                        border: '0.5px solid var(--border-hover)',
                        color: 'var(--text-secondary)',
                      }
                    : undefined
                }
              >
                {user.isFollowing ? 'Following' : 'Follow'}
              </PrimaryBtn>
            )}
          </div>

          {/* Name + badges */}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {fullName}
              </span>
              <Badge variant={roleBadgeVariant(user.role)}>{roleLabel(user.role)}</Badge>
              {user.profile.department && (
                <Badge variant="neutral">
                  {user.profile.department}
                  {user.profile.batchYear && ` '${user.profile.batchYear.slice(-2)}`}
                </Badge>
              )}
            </div>

            {user.profile.headline && (
              <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {user.profile.headline}
              </p>
            )}
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              marginTop: 16,
              borderTop: '0.5px solid var(--border-default)',
              paddingTop: 14,
            }}
          >
            {(
              [
                { label: 'following', value: user.stats.following, mode: 'following' as FollowMode },
                { label: 'followers', value: user.stats.followers, mode: 'followers' as FollowMode },
                { label: 'posts', value: user.stats.posts, mode: null },
              ] as const
            ).map(({ label, value, mode }, idx) => (
              <button
                key={label}
                type="button"
                onClick={mode ? () => setFollowModal(mode) : undefined}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  borderLeft: idx > 0 ? '0.5px solid var(--border-default)' : 'none',
                  background: 'none',
                  border: 'none',
                  cursor: mode ? 'pointer' : 'default',
                  padding: '2px 0',
                }}
                onMouseEnter={(e) => {
                  if (mode) e.currentTarget.style.opacity = '0.75'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {value.toLocaleString()}
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 8px',
          display: 'flex',
          gap: 2,
        }}
      >
        {TABS.map(({ label, value }) => {
          const active = activeTab === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
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
              }}
            >
              {label}
            </button>
          )
        })}
      </nav>

      {/* Tab content */}
      {activeTab === 'posts' ? (
        <PostsFeed />
      ) : (
        <BadgeGrid />
      )}

      {editOpen && <EditProfileModal onClose={() => setEditOpen(false)} />}

      {followModal && user && (
        <FollowModal
          userId={user.id}
          mode={followModal}
          count={followModal === 'followers' ? user.stats.followers : user.stats.following}
          onClose={() => setFollowModal(null)}
        />
      )}
    </div>
  )
}
