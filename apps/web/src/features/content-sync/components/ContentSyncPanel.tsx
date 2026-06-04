import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw, Check, AlertTriangle } from 'lucide-react'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import {
  useContentSyncConfig,
  usePendingImported,
  usePublishImported,
  useSyncRuns,
  useTriggerSync,
  useUpdateContentSyncConfig,
} from '../hooks/useContentSync'

const card: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const label: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-page)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  padding: '9px 12px',
  color: 'var(--text-primary)',
  fontSize: 14,
}

const SOURCES = [
  { key: 'newsUrl', label: 'News page URL', placeholder: 'https://www.uiu.ac.bd/news/' },
  { key: 'noticeUrl', label: 'Notice page URL', placeholder: 'https://www.uiu.ac.bd/notice/' },
  { key: 'eventUrl', label: 'Event page URL', placeholder: 'https://www.uiu.ac.bd/event/' },
] as const

export function ContentSyncPanel() {
  const navigate = useNavigate()
  const { data: config, isLoading } = useContentSyncConfig()
  const { data: runs } = useSyncRuns()
  const { data: pending } = usePendingImported()
  const publishImported = usePublishImported()
  const updateConfig = useUpdateContentSyncConfig()
  const triggerSync = useTriggerSync()

  const [draft, setDraft] = useState({ newsUrl: '', noticeUrl: '', eventUrl: '', enabled: false })
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      setDraft({
        newsUrl: config.newsUrl ?? '',
        noticeUrl: config.noticeUrl ?? '',
        eventUrl: config.eventUrl ?? '',
        enabled: config.enabled,
      })
    }
  }, [config])

  const isRunning = (runs ?? []).some((r) => r.status === 'running')
  const lastRun = (runs ?? [])[0]
  const hasSource = Boolean(draft.newsUrl || draft.noticeUrl || draft.eventUrl)

  function save() {
    setError(null)
    updateConfig.mutate(
      {
        newsUrl: draft.newsUrl || null,
        noticeUrl: draft.noticeUrl || null,
        eventUrl: draft.eventUrl || null,
        enabled: draft.enabled,
      },
      {
        onSuccess: () => {
          setSavedMsg('Settings saved.')
          setTimeout(() => setSavedMsg(null), 4000)
        },
        onError: (e) => setError(extractError(e, 'Could not save settings.')),
      },
    )
  }

  function sync() {
    setError(null)
    triggerSync.mutate(undefined, {
      onError: (e) => setError(extractError(e, 'Could not start sync.')),
    })
  }

  if (isLoading) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Content sync sources</h3>
          <p style={{ ...label, marginTop: 4 }}>
            Scrape news, notices and events from the university website and import them as drafts for review.
          </p>
        </div>

        {SOURCES.map((source) => (
          <div key={source.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={label}>{source.label}</span>
            <input
              style={inputStyle}
              type="url"
              value={draft[source.key]}
              placeholder={source.placeholder}
              onChange={(e) => setDraft((d) => ({ ...d, [source.key]: e.target.value }))}
            />
          </div>
        ))}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
          />
          <span style={{ fontSize: 14 }}>Enable content sync for this university</span>
        </label>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <PrimaryBtn onClick={save} disabled={updateConfig.isPending}>
            {updateConfig.isPending ? 'Saving…' : 'Save settings'}
          </PrimaryBtn>
          <GhostBtn onClick={sync} disabled={!draft.enabled || !hasSource || isRunning || triggerSync.isPending}>
            <RefreshCw size={14} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
            {isRunning ? 'Syncing…' : 'Sync now'}
          </GhostBtn>
          {savedMsg && (
            <span style={{ fontSize: 13, color: 'var(--success, #16a34a)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={14} /> {savedMsg}
            </span>
          )}
          {error && (
            <span style={{ fontSize: 13, color: 'var(--danger, #dc2626)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={14} /> {error}
            </span>
          )}
        </div>
      </div>

      {(() => {
        const pendingItems = [
          ...(pending?.news ?? []).map((n) => ({ kind: 'news' as const, id: n.id, title: n.title, meta: n.category })),
          ...(pending?.events ?? []).map((e) => ({ kind: 'event' as const, id: e.id, title: e.title, meta: 'event' })),
        ]
        if (pendingItems.length === 0) return null
        return (
          <div style={card}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Pending review</h3>
              <p style={{ ...label, marginTop: 4 }}>
                Imported drafts awaiting publish. Publishing a notice also makes it the featured announcement.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingItems.map((item) => (
                <div
                  key={`${item.kind}-${item.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    background: 'var(--surface-page)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </p>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{item.meta}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <GhostBtn
                      onClick={() => navigate(item.kind === 'news' ? `/news/${item.id}` : `/events/${item.id}`)}
                    >
                      Review
                    </GhostBtn>
                    <PrimaryBtn
                      onClick={() => publishImported.mutate({ kind: item.kind, id: item.id })}
                      disabled={publishImported.isPending}
                    >
                      Publish
                    </PrimaryBtn>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <div style={card}>
        <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Recent syncs</h3>
        {lastRun && (
          <p style={label}>
            Last synced {formatDistanceToNow(new Date(lastRun.startedAt), { addSuffix: true })}
            {lastRun.status === 'success' && ` · ${lastRun.itemsNew} new`}
          </p>
        )}
        {(runs ?? []).length === 0 ? (
          <p style={label}>No syncs yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(runs ?? []).map((run) => (
              <div
                key={run.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--surface-page)',
                  borderRadius: 'var(--r-md)',
                  fontSize: 13,
                }}
              >
                <span>{formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}</span>
                <span style={{ color: statusColor(run.status) }}>
                  {run.status === 'success'
                    ? `${run.itemsNew} new`
                    : run.status === 'running'
                      ? 'Running…'
                      : `Failed${run.error ? `: ${run.error}` : ''}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function statusColor(status: string): string {
  if (status === 'success') return 'var(--success, #16a34a)'
  if (status === 'failed') return 'var(--danger, #dc2626)'
  return 'var(--text-secondary)'
}

function extractError(error: unknown, fallback: string): string {
  if (isAxiosError(error)) return (error.response?.data as { error?: string })?.error ?? fallback
  return fallback
}
