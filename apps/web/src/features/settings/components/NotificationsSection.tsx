import { toast } from 'sonner'
import {
  NOTIFICATION_CATEGORY_META,
  USER_CONTROLLABLE_CATEGORIES,
  type ControllableCategory,
  type EmailDigestFrequency,
  type NotificationChannel,
  type QuietHours,
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

          <QuietHoursPanel
            quietHours={prefs.quietHours}
            disabled={update.isPending}
            onUpdate={(patch) => update.mutate({ quietHours: { ...prefs.quietHours, ...patch } })}
          />

          <DigestPanel
            value={prefs.emailDigest}
            disabled={update.isPending}
            onChange={(emailDigest) => update.mutate({ emailDigest })}
          />
        </div>
      )}
    </div>
  )
}

function QuietHoursPanel({
  quietHours,
  disabled,
  onUpdate,
}: {
  quietHours: QuietHours
  disabled: boolean
  onUpdate: (patch: Partial<QuietHours>) => void
}) {
  return (
    <div style={{ borderTop: '0.5px solid var(--border-default)', padding: '14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Quiet hours</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Pause push alerts during these hours. In-app notifications still arrive.
          </div>
        </div>
        <Toggle
          label="Enable quiet hours"
          checked={quietHours.enabled}
          disabled={disabled}
          onChange={(enabled) => onUpdate({ enabled })}
        />
      </div>

      {quietHours.enabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            From
            <input
              type="time"
              value={quietHours.start}
              disabled={disabled}
              onChange={(e) => onUpdate({ start: e.target.value })}
              style={timeInputStyle}
            />
          </label>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            to
            <input
              type="time"
              value={quietHours.end}
              disabled={disabled}
              onChange={(e) => onUpdate({ end: e.target.value })}
              style={timeInputStyle}
            />
          </label>
        </div>
      )}
    </div>
  )
}

function DigestPanel({
  value,
  disabled,
  onChange,
}: {
  value: EmailDigestFrequency
  disabled: boolean
  onChange: (next: EmailDigestFrequency) => void
}) {
  return (
    <div
      style={{
        borderTop: '0.5px solid var(--border-default)',
        padding: '14px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Email digest</div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
          Get a daily email summarising your unread notifications.
        </div>
      </div>
      <select
        aria-label="Email digest frequency"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as EmailDigestFrequency)}
        style={{
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-pill)',
          color: 'var(--text-primary)',
          fontSize: 13,
          padding: '6px 12px',
          cursor: 'pointer',
        }}
      >
        <option value="off">Off</option>
        <option value="daily">Daily</option>
      </select>
    </div>
  )
}

const timeInputStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-primary)',
  fontSize: 13,
  padding: '6px 10px',
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
