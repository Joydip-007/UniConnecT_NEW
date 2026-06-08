import { NavLink, Outlet } from 'react-router-dom'
import { Bell, Lock, Palette, UserCog } from 'lucide-react'
import { PATHS } from '@/router/paths'

const NAV = [
  { to: PATHS.SETTINGS_NOTIFICATIONS, label: 'Notifications', Icon: Bell },
  { to: PATHS.SETTINGS_APPEARANCE, label: 'Appearance', Icon: Palette },
  { to: PATHS.SETTINGS_ACCOUNT, label: 'Account', Icon: UserCog },
  { to: PATHS.SETTINGS_PRIVACY, label: 'Privacy', Icon: Lock },
]

export default function SettingsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 20 }}>
        Settings
      </h1>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <nav
          aria-label="Settings sections"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 180,
            flexShrink: 0,
          }}
        >
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 'var(--r-md)',
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--surface-raised)' : 'transparent',
              })}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <section
          style={{
            flex: 1,
            minWidth: 280,
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: 20,
          }}
        >
          <Outlet />
        </section>
      </div>
    </div>
  )
}
