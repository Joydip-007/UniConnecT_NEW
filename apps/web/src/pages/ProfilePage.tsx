import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, UserX } from 'lucide-react'
import { useState } from 'react'
import { publicUserProfileSchema } from '@uniconnect/shared'
import type { PublicUserProfile, ProfileExperience, ProfileEducation } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { roleHome } from '@/config/roleHome'
import { DetailUnavailable } from '@/components/DetailUnavailable'
import { isMissingError } from '@/lib/httpErrors'
import { ROLE_SHELL } from '@/config/roleShell'
import { PATHS } from '@/router/paths'
import { EditProfileModal, ProfileHeader } from '@/features/profile'
import { ProfileAbout } from '@/features/profile/components/ProfileAbout'
import { PostsPanel } from '@/features/profile/components/PostsPanel'
import { BadgesPanel } from '@/features/profile/components/BadgesPanel'
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
import { sectionLock } from '@/features/profile/sectionLock'
import { Modal } from '@/components/Modal'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import type { BackLinkState } from '@/hooks/useBackLink'

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

// ── ProfilePage ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function fetchProfile(path: string): Promise<PublicUserProfile> {
  const r = await api.get<{ data: unknown }>(path)
  const parsed = publicUserProfileSchema.safeParse(r.data.data)
  if (!parsed.success) throw new Error('Unexpected response shape from the server')
  return parsed.data
}

/**
 * The route param is a handle: a UUID (existing links) or a username (vanity URL, which
 * is what Share hands out). Every mutation elsewhere invalidates `['user', <uuid>]`, so a
 * username is resolved to its UUID first and the profile always lives under that key —
 * otherwise Connect / Edit on a vanity-URL profile never refresh the page.
 */
function useProfile(handle: string | undefined) {
  const qc = useQueryClient()
  const isUuid = !!handle && UUID_RE.test(handle)

  const resolved = useQuery({
    queryKey: ['user', 'by-username', handle],
    queryFn: async () => {
      const profile = await fetchProfile(`/users/by-username/${handle}`)
      qc.setQueryData(['user', profile.id], profile)
      return profile.id
    },
    enabled: !!handle && !isUuid,
    staleTime: Infinity,
    retry: 1,
  })

  const userId = isUuid ? handle : resolved.data
  const profile = useQuery<PublicUserProfile>({
    queryKey: ['user', userId],
    queryFn: () => fetchProfile(`/users/${userId}`),
    enabled: !!userId,
    // The resolver just seeded this key; don't refetch it on mount.
    staleTime: 10_000,
    retry: 1,
  })

  if (!isUuid && !resolved.isSuccess) {
    return {
      data: undefined,
      isLoading: resolved.isLoading,
      isError: resolved.isError,
      error: resolved.error,
      refetch: resolved.refetch,
    }
  }
  return profile
}

// Keyed by the route handle so tab and modal state reset when you follow a link from
// one profile to another (same route, so React would otherwise reuse the instance).
export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  return <ProfileView key={id} handle={id} />
}

function ProfileView({ handle }: { handle: string | undefined }) {
  const authUser = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  // A profile is reached from wherever the author's name was clicked (a post, the
  // admin content queue, a message), none of which is a rail row — so the page needs
  // its own way back. `location.key === 'default'` means this is the first entry in
  // the history stack (opened by URL), where -1 would leave the app.
  // A page that passes `{ from }` (Explore) gets an exact return address instead: -1
  // would land on a profile tab change rather than where the visitor came from.
  const [from] = useState(() => (location.state as BackLinkState | null)?.from)
  const goBack = () => {
    if (from) navigate(from.path)
    else if (location.key !== 'default') navigate(-1)
    else navigate(authUser ? ROLE_SHELL[authUser.role].home : PATHS.FEED)
  }
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
  // Featured item awaiting delete confirmation (the trash icon is one click from gone).
  const [featuredToDelete, setFeaturedToDelete] = useState<string | null>(null)

  const { data: user, isLoading, isError, error, refetch } = useProfile(handle)

  const isOwnProfile = !!user && authUser?.id === user.id

  // Delete featured item mutation — passed as onDelete to ProfileFeatured
  const deleteFeatured = useMutation({
    mutationFn: (entryId: string) => api.delete(`/users/me/featured/${entryId}`),
    onSuccess: () => {
      if (user) qc.invalidateQueries({ queryKey: ['profile', 'featured', user.id] })
      setFeaturedToDelete(null)
    },
  })

  if (isLoading) return <SkeletonProfile />

  if (isError || !user) {
    return isError && !isMissingError(error) ? (
      <DetailUnavailable
        kind="failed"
        title="We couldn't load this profile"
        body="Check your connection and try again. If it keeps happening, the profile may be temporarily unavailable."
        onRetry={() => void refetch()}
      />
    ) : (
      <DetailUnavailable
        kind="not-found"
        icon={UserX}
        title="Profile not found"
        body="This account may have been deactivated, or the link is wrong."
        backLabel={`Back to ${roleHome(authUser?.role).name}`}
        onBack={() => navigate(roleHome(authUser?.role).path)}
      />
    )
  }

  const connectionStatus = user.connectionStatus

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        type="button"
        onClick={goBack}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {from?.label ?? 'Back'}
      </button>

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
            onDelete={(entryId) => setFeaturedToDelete(entryId)}
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
            lock={sectionLock(user, 'contact_info', isOwnProfile)}
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
            lock={sectionLock(user, 'experience', isOwnProfile)}
            onAdd={() => setExpModal({ open: true, entry: null })}
            onEdit={(entry) => setExpModal({ open: true, entry })}
          />

          <ProfileEducationSection
            userId={user.id}
            isOwnProfile={isOwnProfile}
            lock={sectionLock(user, 'education', isOwnProfile)}
            onAdd={() => setEduModal({ open: true, entry: null })}
            onEdit={(entry) => setEduModal({ open: true, entry })}
          />
        </div>
      )}

      {/* ── Posts tab ────────────────────────────────────────── */}
      {activeTab === 'posts' && (
        <PostsPanel userId={user.id} isOwnProfile={isOwnProfile} />
      )}

      {/* ── Badges tab ───────────────────────────────────────── */}
      {activeTab === 'badges' && (
        <BadgesPanel userId={user.id} isOwnProfile={isOwnProfile} />
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

      <Modal
        isOpen={featuredToDelete !== null}
        onClose={() => { setFeaturedToDelete(null); deleteFeatured.reset() }}
        title="Remove this featured item?"
      >
        <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 400, color: deleteFeatured.isError ? 'var(--uc-red)' : 'var(--text-secondary)', lineHeight: 1.6 }}>
          {deleteFeatured.isError
            ? "Couldn't remove it — try again."
            : "It will no longer appear on your profile. This can't be undone."}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <GhostBtn type="button" onClick={() => { setFeaturedToDelete(null); deleteFeatured.reset() }} disabled={deleteFeatured.isPending}>
            Keep
          </GhostBtn>
          <PrimaryBtn
            type="button"
            autoFocus
            disabled={deleteFeatured.isPending}
            onClick={() => { if (featuredToDelete) deleteFeatured.mutate(featuredToDelete) }}
            style={{ background: 'var(--uc-red)' }}
          >
            {deleteFeatured.isPending ? 'Removing…' : 'Remove'}
          </PrimaryBtn>
        </div>
      </Modal>
    </div>
  )
}
