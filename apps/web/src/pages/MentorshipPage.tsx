import { BookOpen } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { AlumniView, StudentView, ToastContainer, useToast } from '@/features/mentorship'

export default function MentorshipPage() {
  const role = useAuthStore((s) => s.user?.role)
  const { toasts, addToast } = useToast()

  if (role === 'faculty' || role === 'admin') {
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
      <ToastContainer toasts={toasts} />

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
