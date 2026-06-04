import { toast } from 'sonner'
import {
  NOTIFICATION_CATEGORY_META,
  USER_CONTROLLABLE_CATEGORIES,
  type ControllableCategory,
  type NotificationChannel,
} from '@uniconnect/shared'
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../hooks/useNotificationPreferences'
import { usePushSettings } from '../hooks/usePushSettings'
import { Toggle } from './Toggle'

export default function NotificationsSection() {
  const { data: prefs, isLoading } = useNotificationPreferences()
  const update = useUpdateNotificationPreferences()
  const push = usePushSettings()

  function setChannel(category: ControllableCategory, channel: NotificationChannel, next: boolean) {
    update.mutate({ [category]: { [channel]: next } })
  }

  async function handlePushToggle(next: boolean) {
    if (next) {
      const ok = await push.enable()
      if (!ok) toast.error('Could not enable push. Check your browser notification permission.')
      else toast.success('Push enabled on this device.')
    } else {
      await push.disable()
      toast.success('Push disabled on this device.')
    }
  }

  return (
    <div>
      <SectionHeader
        title="Notifications"
        description="Choose how you hear about activity. In-app shows in your notifications bell; push sends alerts to this device."
      />

      {/* Per-device push opt-in */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '14px 0',
          borderBottom: '0.5px solid var(--border-default)',
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Push on this device
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {!push.supported
              ? 'This browser does not support push notifications.'
              : push.permission === 'denied'
                ? 'Notifications are blocked in your browser settings.'
                : push.enabled
                  ? 'This device is registered for push.'
                  : 'Register this device to receive push alerts.'}
          </div>
        </div>
        <Toggle
          label="Enable push on this device"
          checked={push.enabled}
          disabled={!push.supported || push.loading || push.permission === 'denied'}
          onChange={handlePushToggle}
        />
      </div>

      {isLoading || !prefs ? (
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : (
        <div>
          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 64px 64px',
              alignItems: 'center',
              padding: '6px 0',
              fontSize: 12,
              color: 'var(--text-tertiary)',
            }}
          >
            <span />
            <span style={{ textAlign: 'center' }}>In-app</span>
            <span style={{ textAlign: 'center' }}>Push</span>
          </div>

          {USER_CONTROLLABLE_CATEGORIES.map((category) => {
            const meta = NOTIFICATION_CATEGORY_META[category]
            const pref = prefs[category]
            return (
              <div
                key={category}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 64px 64px',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderTop: '0.5px solid var(--border-default)',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {meta.description}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Toggle
                    label={`${meta.label} in-app`}
                    checked={pref.in_app}
                    disabled={update.isPending}
                    onChange={(next) => setChannel(category, 'in_app', next)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Toggle
                    label={`${meta.label} push`}
                    checked={pref.push}
                    disabled={update.isPending}
                    onChange={(next) => setChannel(category, 'push', next)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <h2 style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  )
}
