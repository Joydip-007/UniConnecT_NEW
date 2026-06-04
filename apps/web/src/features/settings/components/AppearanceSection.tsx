import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore, type ThemeMode } from '@/stores/themeStore'
import { SectionHeader } from './NotificationsSection'

const OPTIONS: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

export default function AppearanceSection() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  return (
    <div>
      <SectionHeader title="Appearance" description="Choose how UniConnecT looks on this account." />
      <div role="radiogroup" aria-label="Theme" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {OPTIONS.map(({ value, label, Icon }) => {
          const checked = mode === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setMode(value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--r-md)',
                border: '0.5px solid var(--border-default)',
                background: checked ? 'var(--surface-raised)' : 'transparent',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={16} />
                {label}
              </span>
              {checked && <Check size={16} style={{ color: 'var(--uc-indigo-l)' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
