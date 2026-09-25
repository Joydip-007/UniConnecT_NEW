import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useToastStore } from '@/stores/toastStore'
import { useGiftCards } from '../../hooks/useGiftCards'
import { useRedeemGiftCard } from '../../hooks/useRedeemGiftCard'
import { useRewards } from '../../hooks/useRewards'
import { useIncomingRequests, useMentorSettings } from '../../hooks/useMentorship'
import { POINTS_PER_USD } from '../../format'
import type { MentorSettings } from '../../types'
import { Eyebrow, Meter } from '../ui'
import { apiErrorMessage, btnStyle, cardStyle, hairline, useIsMobile } from '../styles'
import { AvailabilityTab } from './AvailabilityTab'
import { MenteesTab } from './MenteesTab'
import { RequestsTab } from './RequestsTab'
import { SessionsTab } from './SessionsTab'

const TABS = ['requests', 'mentees', 'sessions', 'availability'] as const
type Tab = (typeof TABS)[number]
const DEFAULT_TAB: Tab = 'requests'

const TAB_LABEL: Record<Tab, string> = {
  requests: 'Requests',
  mentees: 'Mentees',
  sessions: 'Sessions',
  availability: 'Availability',
}

/** Alumni centre column: requests / mentees / sessions / availability, and the points ledger. */
export function AlumniMentorship() {
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab')
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : DEFAULT_TAB
  const [redeemOpen, setRedeemOpen] = useState(false)

  const settingsQuery = useMentorSettings()
  const pendingQuery = useIncomingRequests('pending')
  const menteesQuery = useIncomingRequests('accepted')
  const rewards = useRewards(true)
  const cards = useGiftCards(true)

  const points = rewards.data?.points ?? 0
  const cheapest = Math.min(...(cards.data ?? []).map((c) => c.thresholdPoints), Infinity)
  const redeemable = Number.isFinite(cheapest) && points >= cheapest

  function setTab(next: Tab) {
    const params = new URLSearchParams(searchParams)
    // The default tab stays out of the URL so a shared link is clean.
    if (next === DEFAULT_TAB) params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  const counts: Partial<Record<Tab, number>> = {
    requests: pendingQuery.data?.length,
    mentees: menteesQuery.data?.length,
  }

  const tabs = (
    <div
      role="tablist"
      aria-label="Mentorship sections"
      style={{
        display: 'flex',
        gap: 2,
        background: 'var(--surface-card)',
        border: hairline,
        borderRadius: isMobile ? 'var(--r-pill)' : 'var(--r-lg)',
        padding: isMobile ? 3 : '4px 6px',
        flex: 1,
        minWidth: 0,
      }}
    >
      {TABS.map((t) => {
        const on = tab === t
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              minHeight: isMobile ? 38 : undefined,
              padding: isMobile ? '0 8px' : '8px 16px',
              fontSize: isMobile ? 12 : 13,
              border: 'none',
              borderRadius: 'var(--r-pill)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: on ? 'var(--uc-indigo-bg)' : 'transparent',
              color: on ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
              fontWeight: on ? 500 : 400,
            }}
          >
            {TAB_LABEL[t]}
            {counts[t] ? ` ${counts[t]}` : ''}
          </button>
        )
      })}
    </div>
  )

  // Points are your own activity, so the ledger is orange (mint once redeemable).
  const ledger = (
    <div
      style={{
        ...cardStyle,
        padding: isMobile ? '10px 8px 10px 14px' : '4px 6px 4px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 10 : 12,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 500, lineHeight: 1, color: redeemable ? 'var(--uc-mint)' : 'var(--uc-orange-l)' }}>
        {points}
      </span>
      <span style={{ flex: isMobile ? 1 : undefined, fontSize: 12, color: 'var(--text-secondary)' }}>points</span>
      <button
        type="button"
        onClick={() => setRedeemOpen(true)}
        style={{
          minHeight: isMobile ? 40 : 36,
          padding: '0 16px',
          fontSize: 13,
          fontWeight: 500,
          borderRadius: 'var(--r-pill)',
          border: 'none',
          background: redeemable ? 'var(--uc-mint)' : 'var(--uc-red)',
          color: 'var(--on-accent)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          opacity: redeemable ? 1 : 0.5,
        }}
      >
        Redeem
      </button>
    </div>
  )

  return (
    <>
      {isMobile ? (
        <>
          {ledger}
          {tabs}
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {tabs}
          {ledger}
        </div>
      )}

      {tab === 'requests' && (
        <RequestsTab pending={pendingQuery.data ?? []} settings={settingsQuery.data} isLoading={pendingQuery.isLoading} />
      )}
      {tab === 'mentees' && (
        <MenteesTab
          mentees={menteesQuery.data ?? []}
          settings={settingsQuery.data}
          isLoading={menteesQuery.isLoading}
          onOpenAvailability={() => setTab('availability')}
        />
      )}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'availability' && <AvailabilityTab settings={settingsQuery.data} isLoading={settingsQuery.isLoading} />}

      {redeemOpen && <RedeemModal points={points} onClose={() => setRedeemOpen(false)} />}
    </>
  )
}

function RedeemModal({ points, onClose }: { points: number; onClose: () => void }) {
  const show = useToastStore((s) => s.show)
  const { data: cards, isLoading } = useGiftCards(true)
  const redeem = useRedeemGiftCard()
  const [redeemed, setRedeemed] = useState<string | null>(null)

  const cheapest = Math.min(...(cards ?? []).map((c) => c.thresholdPoints), Infinity)
  const target = Number.isFinite(cheapest) ? cheapest : POINTS_PER_USD
  const met = points >= target
  const color = met ? 'var(--uc-mint)' : 'var(--uc-orange-l)'
  const toGo = Math.max(0, target - points)

  return (
    <Modal isOpen onClose={onClose} title="Redeem points" maxWidth={420} sheet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <span style={{ fontSize: 26, fontWeight: 500, lineHeight: 1, color }}>{points}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', paddingBottom: 2 }}>points · {POINTS_PER_USD} = $1</span>
        </div>
        <Meter pct={(points / target) * 100} color={color} height={6} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {met ? 'You have enough points to redeem a gift card.' : `${toGo} points to your first redeemable card.`}
        </span>

        {redeemed ? (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                padding: 20,
                borderRadius: 'var(--r-md)',
                background: 'var(--surface-raised)',
                textAlign: 'center',
              }}
            >
              <CheckCircle2 size={28} color="var(--uc-mint)" />
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{redeemed} requested</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                An admin sends the code to your registered email once it is fulfilled.
              </span>
            </div>
            <button type="button" onClick={onClose} style={{ ...btnStyle('mint', 40), fontSize: 13 }}>
              Done
            </button>
          </>
        ) : (
          <>
            <Eyebrow style={{ fontSize: 12 }}>Choose a reward</Eyebrow>
            {isLoading && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Loading rewards…</span>}
            {!isLoading && (cards ?? []).length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No rewards are available right now.</span>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(cards ?? []).map((c) => {
                const affordable = points >= c.thresholdPoints
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!affordable || redeem.isPending}
                    className="mentorship-menu-item"
                    onClick={() =>
                      redeem.mutate(c.id, {
                        onSuccess: () => setRedeemed(c.title),
                        onError: (e) => show({ message: apiErrorMessage(e, 'Could not redeem'), type: 'error' }),
                      })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 40,
                      padding: '8px 12px',
                      borderRadius: 'var(--r-sm)',
                      border: hairline,
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      cursor: affordable ? 'pointer' : 'default',
                      opacity: affordable ? 1 : 0.5,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1 }}>{c.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.thresholdPoints} pts</span>
                    <ChevronRight size={14} />
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/** Alumni right rail: how full you are, and what accepting the open requests would do. */
export function AlumniMentorshipRail() {
  const { data } = useMentorSettings()
  if (!data) return null
  return (
    <section style={{ ...cardStyle, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Eyebrow>Mentee capacity</Eyebrow>
      <Meter pct={data.maxMentees > 0 ? (data.currentMentees / data.maxMentees) * 100 : 0} color="var(--uc-mint)" height={4} />
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{capacityText(data)}</span>
    </section>
  )
}

function capacityText(s: MentorSettings) {
  const base = `${s.currentMentees} of ${s.maxMentees} places filled.`
  if (!s.isOpenToMentorship) return `${base} You are not accepting new mentees.`
  if (s.pendingRequests === 0) return base
  const after = Math.min(s.currentMentees + s.pendingRequests, s.maxMentees)
  const which =
    s.pendingRequests === 1 ? 'the open request' : s.pendingRequests === 2 ? 'both open requests' : `all ${s.pendingRequests} open requests`
  return `${base} Accepting ${which} fills ${after} of ${s.maxMentees}.`
}
