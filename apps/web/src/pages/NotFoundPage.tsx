import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, House, LogIn } from 'lucide-react'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { MinimalPageFooter } from '@/components/MinimalPageFooter'
import { ErrorScreenHeader } from '@/components/ErrorScreenHeader'
import { compactBtnClass, errorActionsStyle } from '@/components/errorScreenStyles'
import { roleHome } from '@/config/roleHome'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from '@/router/paths'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const compact = useMediaQuery('(max-width: 767px)')

  const signedIn = Boolean(accessToken && user)
  // Straight to the role's own home: sending an admin or driver to /feed would only
  // bounce them through ProtectedRoute a second time.
  const home = roleHome(signedIn ? user?.role : null)
  const HomeIcon = home.icon
  const iconSize = compact ? 16 : 15

  // `location.key === 'default'` is the first entry in this tab: -1 would leave the app.
  const goBack = () => (location.key === 'default' ? navigate(home.path) : navigate(-1))

  const failedPath = location.pathname
  const chip = compact ? failedPath : `${window.location.host}${failedPath}`

  const primary = signedIn
    ? { label: `Back to ${home.name}`, icon: <HomeIcon size={iconSize} strokeWidth={1.5} />, onClick: () => navigate(home.path) }
    : { label: 'Sign in', icon: <LogIn size={iconSize} strokeWidth={1.5} />, onClick: () => navigate(PATHS.LOGIN) }
  const secondary = signedIn
    ? { label: 'Go back', icon: <ArrowLeft size={iconSize} strokeWidth={1.5} />, onClick: goBack }
    : { label: 'Go to home', icon: <House size={iconSize} strokeWidth={1.5} />, onClick: () => navigate('/') }

  const btnClass = compact ? compactBtnClass : ''

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <ErrorScreenHeader compact={compact} />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: compact ? 14 : 16,
            textAlign: 'center',
            maxWidth: compact ? '100%' : 440,
            width: compact ? '100%' : undefined,
          }}
        >
          <p
            aria-hidden="true"
            style={{
              margin: 0,
              fontSize: compact ? 96 : 120,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: compact ? '-3px' : '-4px',
              color: 'var(--uc-indigo)',
              opacity: 0.25,
              userSelect: 'none',
            }}
          >
            404
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 14 : 8, alignItems: 'center', maxWidth: '100%' }}>
            <h1 style={{ margin: 0, fontSize: compact ? 20 : 22, fontWeight: 500, color: 'var(--text-primary)' }}>
              Page not found
            </h1>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
              The page you're looking for doesn't exist or has been moved. Check the address for a typo.
            </p>
            <span
              style={{
                marginTop: compact ? 0 : 4,
                maxWidth: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '5px 12px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-default)',
                fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              {chip}
            </span>
          </div>

          <div style={{ ...errorActionsStyle(compact), marginTop: 8 }}>
            <PrimaryBtn onClick={primary.onClick} className={btnClass}>
              {primary.icon}
              {primary.label}
            </PrimaryBtn>
            <GhostBtn onClick={secondary.onClick} className={btnClass}>
              {secondary.icon}
              {secondary.label}
            </GhostBtn>
          </div>
        </div>
      </main>
      <MinimalPageFooter compact={compact} />
    </div>
  )
}
