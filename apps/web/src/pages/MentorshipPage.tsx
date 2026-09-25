import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { usePageRails } from '@/stores/pageRailStore'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  AlumniMentorship,
  AlumniMentorshipRail,
  FacultyNotice,
  StudentMentorship,
  StudentMentorshipRail,
} from '@/features/mentorship'
import { MentorshipTab } from '@/pages/admin/MentorshipTab'

const SUBTITLE: Record<string, { desktop: string; mobile: string }> = {
  student: {
    desktop: 'Connect with alumni mentors for career guidance.',
    mobile: 'Connect with alumni mentors for career guidance.',
  },
  alumni: {
    desktop: 'Apply as a mentor, manage requests, and earn rewards for completed sessions.',
    mobile: 'Manage requests, log sessions, earn rewards.',
  },
  admin: {
    desktop: 'Alumni mentor progress, points, and completed session feedback.',
    mobile: 'Alumni mentor progress, points, and completed session feedback.',
  },
}

export default function MentorshipPage() {
  const role = useAuthStore((s) => s.user?.role)
  const isMobile = useMediaQuery('(max-width: 767px)')

  // The design's right rail is page-scoped: "How mentorship works" + your sessions for
  // students, mentee capacity for alumni. Other roles keep the manifest widgets.
  const rightRail = useMemo(
    () => (role === 'student' ? <StudentMentorshipRail /> : role === 'alumni' ? <AlumniMentorshipRail /> : null),
    [role],
  )
  usePageRails(null, rightRail)

  if (role === 'faculty') return <FacultyNotice />

  const subtitle = role ? SUBTITLE[role] : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 16, minWidth: 0 }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: isMobile ? 18 : 20, fontWeight: 500, color: 'var(--text-primary)' }}>
          Mentorship
        </h1>
        {subtitle && (
          <p style={{ margin: 0, fontSize: isMobile ? 12 : 13, color: 'var(--text-secondary)' }}>
            {isMobile ? subtitle.mobile : subtitle.desktop}
          </p>
        )}
      </div>

      {role === 'student' && <StudentMentorship />}
      {role === 'alumni' && <AlumniMentorship />}
      {role === 'admin' && <MentorshipTab />}
    </div>
  )
}
