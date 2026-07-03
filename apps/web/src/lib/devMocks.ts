import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import type { PublicUserProfile } from '@uniconnect/shared'
import { api } from '@/lib/axios'

/**
 * DEV-ONLY backend stub for the `?dev-auth=1` design-verification flow.
 *
 * The screenshot harness runs the real app with no API server, so data-driven
 * pages (e.g. the profile) would otherwise render their error state. This
 * installs a tiny axios adapter that answers the handful of read endpoints the
 * profile page hits with canned data, so captures show real UI (incl. the
 * @username header). It is gated on `import.meta.env.DEV` + `dev-auth=1` and is
 * never wired up in production builds.
 */

const DEV_PROFILE: PublicUserProfile & { visibility?: Record<string, unknown> } = {
  // Must match AuthLoader's DEV_MOCK_USER.id (and screenshot.cjs's DEV_USER_ID)
  // so `isOwnProfile` (authUser.id === user.id) is true on the profile screenshot —
  // otherwise the page renders as if viewing a stranger (Connect button, gated sections).
  // Kept as a real UUID because publicUserProfileSchema.id is `z.string().uuid()`.
  id: '11111111-1111-4111-8111-111111111111',
  username: 'devuser',
  email: 'dev@uiu.ac.bd',
  role: 'student',
  universityId: '22222222-2222-4222-8222-222222222222',
  isVerified: true,
  themePreference: 'dark',
  isActive: true,
  lastActiveAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  profile: {
    fullName: 'Dev User',
    bio: 'Final-year CSE student at UIU. Building UniConnecT. Into distributed systems, design systems, and good coffee.',
    avatarUrl: null,
    coverUrl: null,
    headline: 'CSE @ UIU · Frontend & systems',
    department: 'CSE',
    batchYear: '2024',
    linkedinUrl: 'https://linkedin.com/in/devuser',
    phone: null,
    skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Design systems'],
    isOpenToWork: true,
    isOpenToMentorship: false,
    mentorshipPoints: 0,
    location: 'Dhaka, Bangladesh',
    websiteUrl: null,
    githubUrl: 'https://github.com/devuser',
    portfolioUrl: null,
    isOpenToMsg: true,
  },
  connectionStatus: 'none',
  connectionId: null,
  mutualConnections: 0,
  stats: { connections: 0, pendingReceived: 0, posts: 0 },
}

/** Returns the HTTP body to fake for a GET, or null to defer to the real adapter. */
function resolveMockBody(url: string): unknown | null {
  if (/\/users\/by-username\/[^/]+$/.test(url)) return { data: DEV_PROFILE }
  if (/\/users\/me\/analytics$/.test(url))
    return {
      data: {
        profileViews: { last7d: 18, last30d: 64, last90d: 142 },
        postReach: { reactions: 23, comments: 7, shares: 4, total: 34 },
      },
    }
  if (/\/users\/me\/viewers$/.test(url)) return { data: { items: [], total: 0, page: 1 } }
  if (/\/users\/me\/progress$/.test(url))
    return {
      data: {
        profileScore: 70,
        hasMadePost: false,
        connectionCount: 0,
        isVerified: true,
        hasAddedExperience: false,
        hasAddedEducation: false,
        hasAvatar: false,
        hasBio: true,
        hasHeadline: true,
      },
    }
  if (/\/users\/[^/]+\/experience$/.test(url)) return { data: [] }
  if (/\/users\/[^/]+\/education$/.test(url)) return { data: [] }
  if (/\/users\/[^/]+\/featured$/.test(url)) return { data: [] }
  if (/\/presence$/.test(url)) return { data: [] }
  if (/\/users\/suggestions$/.test(url)) return { data: [] }
  // Bare `/users/:id` (e.g. the left-sidebar mini profile) — keep last so the
  // more specific routes above win.
  if (/\/users\/[^/]+$/.test(url)) return { data: DEV_PROFILE }
  return null
}

let installed = false

export function installDevMocks(): void {
  if (installed) return
  installed = true

  const realAdapter = axios.getAdapter(api.defaults.adapter ?? axios.defaults.adapter)

  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toLowerCase()
    const url = config.url ?? ''
    if (method === 'get') {
      const body = resolveMockBody(url)
      if (body !== null) {
        return {
          data: body,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse
      }
    }
    return realAdapter(config)
  }
}
