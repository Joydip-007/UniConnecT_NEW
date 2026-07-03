import { useCallback } from 'react'
import { BookOpen } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { AlumniView, StudentView } from '@/features/mentorship'
import type { AddToast } from '@/features/mentorship'
import { MentorshipTab } from '@/pages/admin/MentorshipTab'

export default function MentorshipPage() {
  const role = useAuthStore((s) => s.user?.role)
  const show = useToastStore((s) => s.show)
  const addToast = useCallback<AddToast>(
    (message, type = 'success') => {
      show({ message, type })
    },
    [show],
  )

  if (role === 'admin') {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>
            Mentorship
          </h1>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            Alumni mentor progress, points, and completed session feedback.
          </p>
        </div>
        <MentorshipTab />
      </div>
    )
  }

  if (role === 'faculty') {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 48,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <BookOpen size={32} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Mentorship is available for students and alumni.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: 360,
          }}
        >
          Students can browse and request alumni mentors. Alumni can manage incoming requests,
          log sessions, and earn redeemable points.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: '0 0 4px',
            fontSize: 20,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          Mentorship
        </h1>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
          {role === 'student'
            ? 'Connect with alumni mentors for career guidance.'
            : 'Apply as a mentor, manage requests, and earn rewards for completed sessions.'}
        </p>
      </div>

      {role === 'student' && <StudentView addToast={addToast} />}
      {role === 'alumni' && <AlumniView addToast={addToast} />}
    </div>
  )
}
