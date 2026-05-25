import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { publicUserProfileSchema } from '@uniconnect/shared'
import type { PublicUserProfile, ProfileExperience, ProfileEducation } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { EditProfileModal, ProfileHeader } from '@/features/profile'
import { ProfileAbout } from '@/features/profile/components/ProfileAbout'
import { ProfileActivity } from '@/features/profile/components/ProfileActivity'
import { ProfileExperience as ProfileExperienceSection } from '@/features/profile/components/ProfileExperience'
import { ProfileEducation as ProfileEducationSection } from '@/features/profile/components/ProfileEducation'
import { ProfileSkills } from '@/features/profile/components/ProfileSkills'
import { ProfileContactInfo } from '@/features/profile/components/ProfileContactInfo'
import { ProfileFeatured } from '@/features/profile/components/ProfileFeatured'
import { ProfileAnalytics } from '@/features/profile/components/ProfileAnalytics'
import { ProfileViewers } from '@/features/profile/components/ProfileViewers'
import { ProfileTabs } from '@/features/profile/components/ProfileTabs'
import type { ProfileTab } from '@/features/profile/components/ProfileTabs'
import { ExperienceModal } from '@/features/profile/components/ExperienceModal'
import { EducationModal } from '@/features/profile/components/EducationModal'
import { FeaturedModal } from '@/features/profile/components/FeaturedModal'
import { ResumeExportButton } from '@/features/profile/components/ResumeExportButton'

// ── Skeleton ───────────────────────────────────────────────────────────────────

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
        <div style={{ height: 180, background: 'var(--surface-raised)' }} />
        <div style={{ padding: '56px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ height: 16, width: '40%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          <div style={{ height: 13, width: '60%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 32, width: 64, background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Error card ─────────────────────────────────────────────────────────────────

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
      <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.6 }}>
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

// ── ProfilePage ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const authUser = useAuthStore((s) => s.user)
  const isOwnProfile = authUser?.id === id
  const qc = useQueryClient()

  // Tab navigation
  const [activeTab, setActiveTab] = useState<ProfileTab>('about')

  // General edit modal (intro / bio / contact / skills)
  const [editOpen, setEditOpen] = useState(false)

  // Experience modal: null entry = add, defined entry = edit
  const [expModal, setExpModal] = useState<{ open: boolean; entry?: ProfileExperience | null }>({ open: false })
  // Education modal
  const [eduModal, setEduModal] = useState<{ open: boolean; entry?: ProfileEducation | null }>({ open: false })
  // Featured modal
  const [featuredModalOpen, setFeaturedModalOpen] = useState(false)

  const { data: user, isLoading, isError, error, refetch } = useQuery<PublicUserProfile>({
    queryKey: ['user', id],
    queryFn: async () => {
      const r = await api.get<{ data: unknown }>(`/users/${id}`)
      const parsed = publicUserProfileSchema.safeParse(r.data.data)
      if (!parsed.success) throw new Error('Unexpected response shape from the server')
      return parsed.data
    },
    enabled: !!id,
    retry: 1,
  })

  // Delete featured item mutation — passed as onDelete to ProfileFeatured
  const deleteFeatured = useMutation({
    mutationFn: (entryId: string) => api.delete(`/users/me/featured/${entryId}`),
    onSuccess: () => {
      if (id) qc.invalidateQueries({ queryKey: ['profile', 'featured', id] })
    },
  })

  if (isLoading) return <SkeletonProfile />

  if (isError || !user) {
    const message =
      error instanceof Error ? error.message : 'Something went wrong while loading this profile.'
    return <ProfileErrorCard message={message} onRetry={() => refetch()} />
  }

  const connectionStatus = user.connectionStatus

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ProfileHeader user={user} isOwnProfile={isOwnProfile} onEdit={() => setEditOpen(true)} />

      {/* Resume export — own profile only, tucked under the header */}
      {isOwnProfile && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ResumeExportButton user={user} />
        </div>
      )}

      {/* Tab navigation */}
      <ProfileTabs
        active={activeTab}
        postsCount={user.stats.posts}
        onChange={setActiveTab}
      />

      {/* ── About tab ────────────────────────────────────────── */}
      {activeTab === 'about' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ProfileAbout
            bio={user.profile.bio}
            isOwnProfile={isOwnProfile}
            connectionStatus={connectionStatus}
            onEdit={() => setEditOpen(true)}
          />

          <ProfileFeatured
            userId={user.id}
            isOwnProfile={isOwnProfile}
            connectionStatus={connectionStatus}
            onAdd={() => setFeaturedModalOpen(true)}
            onDelete={(entryId) => deleteFeatured.mutate(entryId)}
          />

          <ProfileSkills
            skills={user.profile.skills}
            isOwnProfile={isOwnProfile}
            connectionStatus={connectionStatus}
            onEdit={() => setEditOpen(true)}
          />

          <ProfileContactInfo
            user={user}
            isOwnProfile={isOwnProfile}
            connectionStatus={connectionStatus}
            onEdit={() => setEditOpen(true)}
          />

          {/* Analytics and Viewers — own profile only, at the bottom of About */}
          {isOwnProfile && (
            <>
              <ProfileAnalytics />
              <ProfileViewers />
            </>
          )}
        </div>
      )}

      {/* ── Experience tab ───────────────────────────────────── */}
      {activeTab === 'experience' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ProfileExperienceSection
            userId={user.id}
            isOwnProfile={isOwnProfile}
            connectionStatus={connectionStatus}
            onAdd={() => setExpModal({ open: true, entry: null })}
            onEdit={(entry) => setExpModal({ open: true, entry })}
          />

          <ProfileEducationSection
            userId={user.id}
            isOwnProfile={isOwnProfile}
            connectionStatus={connectionStatus}
            onAdd={() => setEduModal({ open: true, entry: null })}
            onEdit={(entry) => setEduModal({ open: true, entry })}
          />
        </div>
      )}

      {/* ── Posts tab ────────────────────────────────────────── */}
      {activeTab === 'posts' && (
        <ProfileActivity userId={user.id} />
      )}

      {/* Modals */}
      {editOpen && <EditProfileModal onClose={() => setEditOpen(false)} />}

      {expModal.open && (
        <ExperienceModal
          userId={user.id}
          entry={expModal.entry}
          onClose={() => setExpModal({ open: false })}
        />
      )}

      {eduModal.open && (
        <EducationModal
          userId={user.id}
          entry={eduModal.entry}
          onClose={() => setEduModal({ open: false })}
        />
      )}

      {featuredModalOpen && (
        <FeaturedModal
          userId={user.id}
          onClose={() => setFeaturedModalOpen(false)}
        />
      )}
    </div>
  )
}
