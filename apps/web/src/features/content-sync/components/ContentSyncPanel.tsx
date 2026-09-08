import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw, Check, AlertTriangle, Newspaper, Megaphone, Calendar } from 'lucide-react'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import {
  useBackfillAttachments,
  useContentSyncConfig,
  usePendingImported,
  usePublishAllImported,
  usePublishImported,
  useSyncRuns,
  useTriggerSync,
  useUpdateContentSyncConfig,
} from '../hooks/useContentSync'
import { ImportPreviewModal, type ImportPreviewTarget } from './ImportPreviewModal'

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
  { key: 'newsUrl', label: 'News page URL', placeholder: 'https://www.uiu.ac.bd/news/', icon: Newspaper, tone: { color: 'var(--uc-indigo-l)', bg: 'var(--uc-indigo-bg)' } },
  { key: 'noticeUrl', label: 'Notice page URL', placeholder: 'https://www.uiu.ac.bd/notice/', icon: Megaphone, tone: { color: 'var(--uc-orange-l)', bg: 'var(--uc-orange-bg)' } },
  { key: 'eventUrl', label: 'Event page URL', placeholder: 'https://www.uiu.ac.bd/event/', icon: Calendar, tone: { color: 'var(--uc-cyan)', bg: 'var(--uc-cyan-bg)' } },
] as const

/**
 * Four numbers that answer "is this working?" before any field is read. They sit above
 * the form rather than inside it: the form is what you change, this is what changed.
 */
function SyncStat({ label: text, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      padding: '16px 20px',
      flex: '1 1 0',
      minWidth: 130,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{text}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: 'var(--text-primary)', marginTop: 6, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: tone ?? 'var(--text-tertiary)', marginTop: 6 }}>{sub}</div>
    </div>
  )
}

/** Whether a source is set at all — the one thing a URL field cannot say about itself. */
function ConfiguredPill({ set }: { set: boolean }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 500,
      borderRadius: 'var(--r-pill)',
      padding: '1px 8px',
      color: set ? 'var(--uc-mint)' : 'var(--text-tertiary)',
      background: set ? 'var(--uc-mint-bg)' : 'var(--surface-raised)',
      border: `0.5px solid ${set ? 'var(--uc-mint-bdr)' : 'var(--border-default)'}`,
    }}>
      {set ? 'Configured' : 'Not set'}
    </span>
  )
}

export function ContentSyncPanel() {
  const qc = useQueryClient()
  const { data: config, isLoading } = useContentSyncConfig()
  const { data: runs } = useSyncRuns()
  const { data: pending } = usePendingImported()
  const publishImported = usePublishImported()
  const publishAll = usePublishAllImported()
  const updateConfig = useUpdateContentSyncConfig()
  const triggerSync = useTriggerSync()
  const backfillAttachments = useBackfillAttachments()

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState({ newsUrl: '', noticeUrl: '', eventUrl: '', enabled: false, entriesPerSource: 5 })
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewTarget, setPreviewTarget] = useState<ImportPreviewTarget | null>(null)

  // useSyncRuns polls while a run is 'running', but only its own query key refreshes —
  // re-fetch pending/config once we observe a run finish so the page updates without a manual reload.
  const lastSeenRunStatus = useRef<string | undefined>(undefined)
  useEffect(() => {
    const status = runs?.[0]?.status
    if (status && status !== 'running' && lastSeenRunStatus.current === 'running') {
      void qc.invalidateQueries({ queryKey: ['content-sync', 'pending'] })
      void qc.invalidateQueries({ queryKey: ['content-sync', 'config'] })
    }
    lastSeenRunStatus.current = status
  }, [runs, qc])

  useEffect(() => {
    if (config) {
      setDraft({
        newsUrl: config.newsUrl ?? '',
        noticeUrl: config.noticeUrl ?? '',
        eventUrl: config.eventUrl ?? '',
        enabled: config.enabled,
        entriesPerSource: config.entriesPerSource,
      })
    }
  }, [config])

  const isRunning = (runs ?? []).some((r) => r.status === 'running')
  const lastRun = (runs ?? [])[0]
  const hasSource = Boolean(draft.newsUrl || draft.noticeUrl || draft.eventUrl)

  function configPayload() {
    return {
      newsUrl: draft.newsUrl || null,
      noticeUrl: draft.noticeUrl || null,
      eventUrl: draft.eventUrl || null,
      enabled: draft.enabled,
      entriesPerSource: Math.min(50, Math.max(1, draft.entriesPerSource || 5)),
    }
  }

  function save() {
    setError(null)
    updateConfig.mutate(configPayload(), {
      onSuccess: () => {
        setSavedMsg('Settings saved.')
        setTimeout(() => setSavedMsg(null), 4000)
      },
      onError: (e) => setError(extractError(e, 'Could not save settings.')),
    })
  }

  // Persist any unsaved edits (e.g. a changed entry count) before running, so a
  // sync always uses what's currently in the form — not a stale saved value.
  async function sync(backfill = false) {
    setError(null)
    try {
      await updateConfig.mutateAsync(configPayload())
    } catch (e) {
      setError(extractError(e, 'Could not save settings.'))
      return
    }
    triggerSync.mutate(
      { backfill },
      { onError: (e) => setError(extractError(e, 'Could not start sync.')) },
    )
  }

  if (isLoading) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>

  const sourcesSet = SOURCES.filter((src) => !!draft[src.key]).length
  const pendingCount = (pending?.news.length ?? 0) + (pending?.events.length ?? 0)
  const lastRunStat = runs?.[0]
  const importedAllTime = (runs ?? [])
    .filter((r) => r.status === 'success')
    .reduce((n, r) => n + (r.itemsNew ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <SyncStat
          label="Sources configured"
          value={`${sourcesSet}/3`}
          sub={draft.enabled ? 'sync enabled' : 'sync paused'}
          tone={draft.enabled ? 'var(--uc-mint)' : 'var(--uc-amber-l)'}
        />
        <SyncStat
          label="Pending review"
          value={String(pendingCount)}
          sub="imported drafts"
          tone={pendingCount > 0 ? 'var(--uc-amber-l)' : undefined}
        />
        <SyncStat
          label="Last sync"
          value={
            !lastRunStat
              ? '—'
              : lastRunStat.status === 'success'
                ? `${lastRunStat.itemsNew} new`
                : lastRunStat.status === 'running'
                  ? 'Running'
                  : 'Failed'
          }
          sub={lastRunStat ? formatDistanceToNow(new Date(lastRunStat.startedAt), { addSuffix: true }) : 'no runs yet'}
          tone={lastRunStat?.status === 'failed' ? 'var(--uc-red)' : undefined}
        />
        <SyncStat
          label="Items imported"
          value={String(importedAllTime)}
          sub={`across ${(runs ?? []).length} run${(runs ?? []).length === 1 ? '' : 's'}`}
        />
      </div>

      <div style={card}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Content sync sources</h3>
          <p style={{ ...label, marginTop: 4 }}>
            Scrape news, notices and events from the university website and import them as drafts for review.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {SOURCES.map((source, i) => {
            const SourceIcon = source.icon
            return (
              <div
                key={source.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 0',
                  borderTop: i === 0 ? undefined : '0.5px solid var(--border-default)',
                }}
              >
                <span style={{
                  width: 34,
                  height: 34,
                  borderRadius: 'var(--r-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 20,
                  background: source.tone.bg,
                  color: source.tone.color,
                }}>
                  <SourceIcon size={16} strokeWidth={1.5} />
                </span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={label}>{source.label}</span>
                    <ConfiguredPill set={!!draft[source.key]} />
                  </div>
                  <input
                    style={inputStyle}
                    type="url"
                    value={draft[source.key]}
                    placeholder={source.placeholder}
                    onChange={(e) => setDraft((d) => ({ ...d, [source.key]: e.target.value }))}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Entries per source</span>
          <input
            style={{ ...inputStyle, width: 120 }}
            type="number"
            min={1}
            max={50}
            aria-label="Entries per source"
            value={draft.entriesPerSource}
            onChange={(e) => setDraft((d) => ({ ...d, entriesPerSource: Number(e.target.value) }))}
          />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Newest items fetched from each of news, notices and events on every sync.
          </span>
        </div>

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
          <GhostBtn
            onClick={() => void sync(false)}
            disabled={!draft.enabled || !hasSource || isRunning || triggerSync.isPending || updateConfig.isPending}
          >
            <RefreshCw size={14} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
            {isRunning ? 'Syncing…' : 'Sync now'}
          </GhostBtn>
          <GhostBtn
            onClick={() => void sync(true)}
            disabled={!draft.enabled || !hasSource || isRunning || triggerSync.isPending || updateConfig.isPending}
            title="Widen the fetch window so recently-scrolled-past items get imported"
          >
            <RefreshCw size={14} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
            {isRunning ? 'Syncing…' : 'Widen fetch window'}
          </GhostBtn>
          <GhostBtn
            onClick={() => {
              setError(null)
              backfillAttachments.mutate(undefined, {
                onSuccess: () => {
                  setSavedMsg('Attachment backfill queued — check back shortly.')
                  setTimeout(() => setSavedMsg(null), 6000)
                },
                onError: (e) => setError(extractError(e, 'Could not queue attachment backfill.')),
              })
            }}
            disabled={backfillAttachments.isPending}
            title="Re-fetch every already-imported item by its own URL to pull attachments the recency window can no longer reach, and retry any failed downloads"
          >
            <RefreshCw size={14} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
            {backfillAttachments.isPending ? 'Queuing…' : 'Backfill attachments'}
          </GhostBtn>
          {savedMsg && (
            <span style={{ fontSize: 13, color: 'var(--uc-mint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={14} /> {savedMsg}
            </span>
          )}
          {error && (
            <span style={{ fontSize: 13, color: 'var(--uc-red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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

        const keyOf = (i: { kind: 'news' | 'event'; id: string }) => `${i.kind}-${i.id}`
        const selectedItems = pendingItems.filter((i) => selectedKeys.has(keyOf(i)))
        const allSelected = selectedItems.length === pendingItems.length

        function toggle(k: string) {
          setSelectedKeys((prev) => {
            const next = new Set(prev)
            if (next.has(k)) next.delete(k)
            else next.add(k)
            return next
          })
        }
        function toggleAll() {
          setSelectedKeys(allSelected ? new Set() : new Set(pendingItems.map(keyOf)))
        }

        return (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Pending review</h3>
                <p style={{ ...label, marginTop: 4 }}>
                  Imported drafts awaiting publish. Tick the ones you want, then publish in bulk — or review each first.
                </p>
              </div>
              <PrimaryBtn
                onClick={() =>
                  publishAll.mutate(
                    selectedItems.map((i) => ({ kind: i.kind, id: i.id })),
                    { onSuccess: () => setSelectedKeys(new Set()) },
                  )
                }
                disabled={publishAll.isPending || selectedItems.length === 0}
              >
                {publishAll.isPending ? 'Publishing…' : `Publish selected (${selectedItems.length})`}
              </PrimaryBtn>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                style={{ width: 14, height: 14, accentColor: 'var(--uc-indigo)', cursor: 'pointer' }}
              />
              Select all ({pendingItems.length})
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingItems.map((item) => {
                const k = keyOf(item)
                return (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      background: 'var(--surface-page)',
                      borderRadius: 'var(--r-md)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(k)}
                      onChange={() => toggle(k)}
                      aria-label={`Select ${item.title}`}
                      style={{ width: 14, height: 14, accentColor: 'var(--uc-indigo)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </p>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{item.meta}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <GhostBtn onClick={() => setPreviewTarget({ kind: item.kind, id: item.id })}>
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
                )
              })}
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

      <ImportPreviewModal
        target={previewTarget}
        onClose={() => setPreviewTarget(null)}
        publishing={publishImported.isPending}
        onPublish={(target) =>
          publishImported.mutate(target, { onSuccess: () => setPreviewTarget(null) })
        }
      />
    </div>
  )
}

function statusColor(status: string): string {
  if (status === 'success') return 'var(--uc-mint)'
  if (status === 'failed') return 'var(--uc-red)'
  return 'var(--text-secondary)'
}

function extractError(error: unknown, fallback: string): string {
  if (isAxiosError(error)) return (error.response?.data as { error?: string })?.error ?? fallback
  return fallback
}
