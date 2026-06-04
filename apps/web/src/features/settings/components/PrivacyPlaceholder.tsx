import { Lock } from 'lucide-react'
import { SectionHeader } from './NotificationsSection'

export default function PrivacyPlaceholder() {
  return (
    <div>
      <SectionHeader title="Privacy" description="Control who can see your profile and activity." />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '40px 20px',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
        }}
      >
        <Lock size={28} />
        <p style={{ fontSize: 14 }}>Profile privacy controls are coming soon.</p>
      </div>
    </div>
  )
}
