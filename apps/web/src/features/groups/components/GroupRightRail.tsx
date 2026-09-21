import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart2, ChevronRight, Settings, ShieldCheck, UserPlus, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GROUP_EVENTS } from '@uniconnect/shared'
import { socket } from '@/lib/socket'
import { Modal } from '@/components/Modal'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { TrendingTagsList, useTrendingTags } from '@/components/rightRail/TrendingTagsWidget'
import { getInitials } from '@/utils/avatar'
import { TYPE_LOOK } from '../groupTypeLook'
import {
  reviewSummaryKey,
  useDeleteGroup,
  useGroupStats,
  useGroupSuggestions,
  useReviewSummary,
  useSetRules,
  useToggleGroupMembership,
  useUpdateGroupDescription,
  useUpdateGroupSettings,
} from '../hooks/useGroupExtended'
import type { GroupSettingsPatch } from '../hooks/useGroupExtended'
import { AnalyticsPanel } from './AnalyticsPanel'
import { InvitePanel } from './InvitePanel'
import { ModLogPanel } from './ModLogPanel'
import { defaultTabFor } from './GroupLeftRail'
import type { GroupTab } from './GroupLeftRail'
import type { Group } from '../types'

// ── Shared chrome ────────────────────────────────────────────────────────────

const cardStyle: CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.04em',
  color: 'var(--text-label)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const ghostPill: CSSProperties = {
  padding: '3px 10px',
  fontSize: 12,
  fontWeight: 400,
  fontFamily: 'inherit',
  borderRadius: 'var(--r-pill)',
  border: '0.5px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}

function Divider() {
  return <div aria-hidden style={{ height: '0.5px', background: 'var(--border-default)' }} />
}

function Eyebrow({ children, tone, icon: Icon }: { children: ReactNode; tone?: 'orange'; icon?: LucideIcon }) {
  return (
    <div style={{ ...eyebrowStyle, color: tone === 'orange' ? 'var(--uc-orange-l)' : 'var(--text-label)' }}>
      {Icon && <Icon size={13} strokeWidth={1.5} aria-hidden />}
      {children}
    </div>
  )
}

// ── Manage card ──────────────────────────────────────────────────────────────

function QueueRow({ title, meta, onReview }: { title: string; meta: string; onReview?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--surface-raised)',
        borderRadius: 'var(--r-md)',
        padding: '10px 12px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
        <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{meta}</p>
      </div>
      {onReview && (
        <button type="button" onClick={onReview} style={ghostPill}>
          Review
        </button>
      )}
    </div>
  )
}

function ActionRow({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="admin-rail-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        height: 40,
        padding: '0 8px',
        fontSize: 13,
        fontWeight: 400,
        fontFamily: 'inherit',
        color: 'var(--text-primary)',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Icon size={15} strokeWidth={1.5} aria-hidden style={{ color: 'var(--text-secondary)' }} />
      <span style={{ flex: 1 }}>{label}</span>
      <ChevronRight size={14} strokeWidth={1.5} aria-hidden style={{ color: 'var(--text-tertiary)' }} />
    </button>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

type Overlay = 'invite' | 'analytics' | 'modlog' | null

function ManageCard({ group, onToggleSettings }: { group: Group; onToggleSettings: () => void }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [overlay, setOverlay] = useState<Overlay>(null)
  const { data: summary } = useReviewSummary(group.id)
  const { data: stats } = useGroupStats(group.id)

  useEffect(() => {
    function onQueueChanged(payload: { groupId?: string } | undefined) {
      if (payload?.groupId && payload.groupId !== group.id) return
      queryClient.invalidateQueries({ queryKey: reviewSummaryKey(group.id) })
      queryClient.invalidateQueries({ queryKey: ['groups', 'join-requests', { groupId: group.id }] })
    }
    socket.on(GROUP_EVENTS.REVIEW_QUEUE_CHANGED, onQueueChanged)
    return () => {
      socket.off(GROUP_EVENTS.REVIEW_QUEUE_CHANGED, onQueueChanged)
    }
  }, [group.id, queryClient])

  function go(tab: GroupTab) {
    const params = new URLSearchParams(searchParams)
    if (tab === defaultTabFor(group)) params.delete('tab')
    else params.set('tab', tab)
    navigate({ search: params.toString() })
  }

  const joins = summary?.pendingJoinRequests ?? 0
  const queued = (summary?.pendingPosts ?? 0) + (summary?.pendingEvents ?? 0)
  const reports = summary?.reportsOpen ?? 0

  return (
    <section aria-label="Manage this group" style={cardStyle}>
      <Eyebrow tone="orange" icon={ShieldCheck}>
        Manage this group
      </Eyebrow>

      <QueueRow
        title="Join requests"
        meta={joins > 0 ? `${joins} ${joins === 1 ? 'request' : 'requests'} waiting` : 'No requests waiting'}
        onReview={() => go('join-requests')}
      />
      <QueueRow
        title="Queued posts"
        meta={queued > 0 ? `${queued} waiting` : 'All caught up'}
        onReview={() => go('feed')}
      />
      <QueueRow
        title="Moderation"
        meta={reports > 0 ? `${reports} ${reports === 1 ? 'report' : 'reports'} open` : 'Nothing flagged this week'}
      />

      <Divider />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <ActionRow icon={UserPlus} label="Invite members" onClick={() => setOverlay('invite')} />
        {!group.isSystem && (
          <ActionRow icon={Settings} label="Group settings" onClick={onToggleSettings} />
        )}
        <ActionRow icon={BarChart2} label="Analytics" onClick={() => setOverlay('analytics')} />
        <ActionRow icon={ShieldCheck} label="Moderation log" onClick={() => setOverlay('modlog')} />
      </div>

      <Divider />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <MiniStat label="New members, 7 days" value={`+${stats?.newMembersThisWeek ?? 0}`} />
        <MiniStat label="Posts, 7 days" value={String(stats?.postsThisWeek ?? 0)} />
        <MiniStat label="Reports open" value={String(reports)} />
      </div>

      {overlay === 'invite' && <InvitePanel group={group} onClose={() => setOverlay(null)} />}
      {overlay === 'analytics' && <AnalyticsPanel groupId={group.id} onClose={() => setOverlay(null)} />}
      {overlay === 'modlog' && <ModLogPanel groupId={group.id} onClose={() => setOverlay(null)} />}
    </section>
  )
}

// ── Settings card ────────────────────────────────────────────────────────────

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 30,
        height: 17,
        flexShrink: 0,
        padding: 0,
        borderRadius: 'var(--r-pill)',
        border: '0.5px solid var(--border-default)',
        background: checked ? 'var(--uc-indigo)' : 'var(--surface-raised)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 150ms ease',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 15 : 2,
          width: 11,
          height: 11,
          borderRadius: '50%',
          background: checked ? 'var(--on-accent)' : 'var(--text-tertiary)',
          transition: 'left 150ms ease',
        }}
      />
    </button>
  )
}

function SettingsCard({ group, onClose }: { group: Group; onClose: () => void }) {
  const navigate = useNavigate()
  const update = useUpdateGroupSettings(group.id)
  const del = useDeleteGroup(group.id)
  const [confirming, setConfirming] = useState(false)

  function patch(p: GroupSettingsPatch) {
    update.mutate(p)
  }

  const rows: { key: keyof GroupSettingsPatch; label: string; value: boolean }[] = [
    { key: 'is_private', label: 'Private group', value: group.isPrivate },
    { key: 'require_post_approval', label: 'Require post approval', value: group.requirePostApproval ?? false },
    { key: 'require_event_approval', label: 'Require event approval', value: group.requireEventApproval ?? false },
  ]

  return (
    <section aria-label="Group settings" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ ...eyebrowStyle, flex: 1 }}>Group settings</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close group settings"
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: '50%', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => (
          <label key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 400, color: 'var(--text-primary)' }}>{r.label}</span>
            <Switch label={r.label} checked={r.value} disabled={update.isPending} onChange={(next) => patch({ [r.key]: next })} />
          </label>
        ))}
      </div>

      {group.userRole === 'owner' && (
        <>
          <Divider />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 400, color: 'var(--uc-red)' }}>Delete group</span>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              style={{ ...ghostPill, border: '0.5px solid var(--uc-red-bdr)', color: 'var(--uc-red)' }}
            >
              Delete
            </button>
          </div>
        </>
      )}

      <Modal isOpen={confirming} onClose={() => setConfirming(false)} title="Delete this group?">
        <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          This removes {group.name}, its posts, resources and members for everyone. It cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <GhostBtn type="button" onClick={() => setConfirming(false)}>
            Cancel
          </GhostBtn>
          <PrimaryBtn
            type="button"
            disabled={del.isPending}
            onClick={() => del.mutate(undefined, { onSuccess: () => navigate('/groups') })}
            style={{ background: 'var(--uc-red)' }}
          >
            {del.isPending ? 'Deleting…' : 'Delete group'}
          </PrimaryBtn>
        </div>
      </Modal>
    </section>
  )
}

// ── About card ───────────────────────────────────────────────────────────────

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: 10,
  fontSize: 13,
  fontWeight: 400,
  fontFamily: 'inherit',
  lineHeight: 1.6,
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-primary)',
  resize: 'vertical',
  boxSizing: 'border-box',
}

function AboutCard({ group, canEdit, editSignal }: { group: Group; canEdit: boolean; editSignal: number }) {
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(group.description ?? '')
  const [rules, setRules] = useState(group.rulesMd ?? '')
  const updateDescription = useUpdateGroupDescription(group.id)
  const setRulesMutation = useSetRules(group.id)
  const saving = updateDescription.isPending || setRulesMutation.isPending

  useEffect(() => {
    if (editSignal > 0 && canEdit) {
      setDescription(group.description ?? '')
      setRules(group.rulesMd ?? '')
      setEditing(true)
    }
    // Only the signal should re-open the editor; group fields are read when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSignal, canEdit])

  function startEdit() {
    setDescription(group.description ?? '')
    setRules(group.rulesMd ?? '')
    setEditing(true)
  }

  async function save() {
    const jobs: Promise<unknown>[] = []
    const nextDescription = description.trim()
    if (nextDescription && nextDescription !== (group.description ?? '')) {
      jobs.push(updateDescription.mutateAsync(nextDescription))
    }
    if (rules !== (group.rulesMd ?? '')) jobs.push(setRulesMutation.mutateAsync(rules))
    try {
      await Promise.all(jobs)
      setEditing(false)
    } catch {
      // mutation hooks surface errors through the query cache; keep the editor open
    }
  }

  return (
    <section aria-label="About this group" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ ...eyebrowStyle, flex: 1 }}>About this group</div>
        {canEdit && !editing && (
          <button type="button" onClick={startEdit} style={ghostPill}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            aria-label="Group description"
            placeholder="What is this group for?"
            style={textareaStyle}
          />
          <Eyebrow>Group rules</Eyebrow>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={6}
            maxLength={5000}
            aria-label="Group rules"
            placeholder="One rule per line"
            style={textareaStyle}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setEditing(false)} style={ghostPill}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              style={{ ...ghostPill, border: 'none', background: 'var(--uc-indigo)', color: 'var(--on-accent)', fontWeight: 500, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, lineHeight: 1.65, color: group.description ? 'var(--text-secondary)' : 'var(--text-tertiary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {group.description || 'No description yet.'}
          </p>
          <Divider />
          <Eyebrow>Group rules</Eyebrow>
          {group.rulesMd ? (
            <pre style={{ margin: 0, fontSize: 13, fontWeight: 400, lineHeight: 1.6, fontFamily: 'inherit', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {group.rulesMd}
            </pre>
          ) : (
            <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>No rules set yet.</p>
          )}
        </>
      )}
    </section>
  )
}

// ── Member-only cards ────────────────────────────────────────────────────────

function SuggestionRow({ group }: { group: Group }) {
  const navigate = useNavigate()
  const toggle = useToggleGroupMembership(group)
  const [done, setDone] = useState<'Joined' | 'Requested' | null>(null)
  const look = TYPE_LOOK[group.type] ?? TYPE_LOOK.other
  const meta = `${look.label} · ${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        onClick={() => navigate(`/groups/${group.id}`)}
        aria-label={`Open ${group.name}`}
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          padding: 0,
          border: 'none',
          borderRadius: 'var(--r-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 500,
          background: look.bg,
          color: look.fg,
          backgroundImage: group.avatarUrl ? `url(${group.avatarUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          cursor: 'pointer',
        }}
      >
        {group.avatarUrl ? '' : getInitials(group.name)}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group.name}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>{meta}</p>
      </div>
      {done ? (
        <span style={{ ...ghostPill, background: 'var(--surface-raised)', border: 'none', cursor: 'default' }}>{done}</span>
      ) : (
        <button
          type="button"
          disabled={toggle.isPending}
          onClick={() =>
            toggle.mutate(undefined, {
              onSuccess: (data) => setDone(data && 'requested' in data && data.requested ? 'Requested' : 'Joined'),
            })
          }
          style={{ ...ghostPill, border: 'none', background: 'var(--uc-indigo-bg)', color: 'var(--uc-indigo-l)', fontWeight: 500 }}
        >
          {group.isPrivate ? 'Request' : 'Join'}
        </button>
      )}
    </div>
  )
}

function SuggestionsCard() {
  const { data: suggestions } = useGroupSuggestions(4)
  if (!suggestions || suggestions.length === 0) return null
  return (
    <section aria-label="Groups you may like" style={cardStyle}>
      <Eyebrow>Groups you may like</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suggestions.map((g) => (
          <SuggestionRow key={g.id} group={g} />
        ))}
      </div>
    </section>
  )
}

function TrendingCard() {
  const { data: tags } = useTrendingTags()
  if (!tags || tags.length === 0) return null
  return (
    <section aria-label="Trending now" style={cardStyle}>
      <Eyebrow>Trending now</Eyebrow>
      <TrendingTagsList tags={tags} />
    </section>
  )
}

// ── Rail ─────────────────────────────────────────────────────────────────────

export function GroupRightRail({
  group,
  editAboutSignal = 0,
}: {
  group: Group
  /** Accepted so the page can memoize on it; the rail renders the same cards on every tab. */
  activeTab: GroupTab
  /** Incremented by the page (e.g. the pinned banner's Edit) to open the About editor. */
  editAboutSignal?: number
}) {
  const isAdmin = group.userRole === 'owner' || group.userRole === 'admin'
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isAdmin ? (
        <>
          <ManageCard group={group} onToggleSettings={() => setSettingsOpen((v) => !v)} />
          {settingsOpen && !group.isSystem && <SettingsCard group={group} onClose={() => setSettingsOpen(false)} />}
          <AboutCard group={group} canEdit editSignal={editAboutSignal} />
        </>
      ) : (
        <>
          <AboutCard group={group} canEdit={false} editSignal={0} />
          <SuggestionsCard />
          <TrendingCard />
        </>
      )}
    </div>
  )
}
