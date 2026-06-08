import { useNavigate } from 'react-router-dom'
import { PrimaryBtn } from '@/components/Button'
import { LandingFooter } from '@/features/landing/components/LandingFooter'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-page)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
          maxWidth: 400,
        }}
      >
        {/* Large 404 */}
        <p
          style={{
            margin: 0,
            fontSize: 120,
            fontWeight: 500,
            lineHeight: 1,
            color: 'var(--uc-indigo)',
            opacity: 0.25,
            letterSpacing: '-4px',
            userSelect: 'none',
          }}
        >
          404
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            Page not found
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <PrimaryBtn onClick={() => navigate('/feed')} style={{ marginTop: 8 }}>
          Back to feed
        </PrimaryBtn>
      </div>
      </div>
      <LandingFooter />
    </div>
  )
}
