import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, ListChecks, Route } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  BadgesView, LearnRightRail, LearnStreakCard, PATHS_PREVIEW_COUNT, PastResultsModal, PathCard, PathDetailModal,
  QuizList, QuizModal, buildBadgeCards, buildPathFilters, isBadgeFilterKey, isPathFilterKey, matchesPathFilter,
  useBadgeProgress, useMyQuizzes, usePaths, usePinBadge, useToday,
  type BadgeCard, type BadgeFilterKey, type PathFilterKey,
} from '@/features/learning'
import { FilterChip, RoundIconButton } from '@/features/learning/components/learnUi'
import { DailyQuizCard, LeaderboardPanel } from '@/features/quiz'
import { useAuthStore } from '@/stores/authStore'
import { usePageRails } from '@/stores/pageRailStore'
import { useToastStore } from '@/stores/toastStore'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { listStagger, listItem } from '@/lib/motion'

/** Which dialog is open. `from` records where Back returns to. */
type Overlay =
  | { kind: 'path'; pathId: string; unitId: string | null }
  | { kind: 'quiz'; pathId: string; unitId: string; from: 'unit' | null }
  | { kind: 'results'; pathId: string; unitId: string; from: 'unit' | 'quiz' | null; quizFrom: 'unit' | null }

type LearnTab = 'paths' | 'quizzes'

function Skeleton({ height }: { height: number }) {
  return (
    <div style={{ height, borderRadius: 'var(--r-lg)', background: 'var(--surface-card)', border: '0.5px solid var(--border-default)' }} />
  )
}

export default function LearnPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const isStudent = user?.role === 'student'
  const isPhone = useMediaQuery('(max-width: 767px)')
  // The right rail (and the streak card in it) is hidden below 1100px, so the card moves
  // into the centre column there.
  const railHidden = useMediaQuery('(max-width: 1100px)')
  const prefersReducedMotion = useReducedMotion()
  const show = useToastStore((s) => s.show)

  const rightRail = useMemo(() => <LearnRightRail />, [])
  usePageRails(null, rightRail)

  const { data: paths, isLoading: pathsLoading } = usePaths()
  const { data: today } = useToday()
  const { data: quizzes, isLoading: quizzesLoading } = useMyQuizzes()
  const { data: badgeProgress } = useBadgeProgress(isStudent)
  const pinBadge = usePinBadge()
  const [overlay, setOverlay] = useState<Overlay | null>(null)

  // ── URL state: every default stays out of the URL so a shared link is clean ─────────
  const view = searchParams.get('view')
  const badgesView = view === 'badges' && isStudent
  const pathsAll = view === 'paths'
  const tab: LearnTab = pathsAll ? 'paths' : searchParams.get('tab') === 'quizzes' ? 'quizzes' : 'paths'
  const rawStatus = searchParams.get('status')
  const statusFilter: PathFilterKey = isPathFilterKey(rawStatus) ? rawStatus : 'all'
  const rawCat = searchParams.get('cat')
  const badgeFilter: BadgeFilterKey = isBadgeFilterKey(rawCat) ? rawCat : 'all'
  const focusBadge = searchParams.get('badge')

  function patchParams(patch: Record<string, string | null>, replace = true) {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setSearchParams(next, { replace })
  }

  const allPaths = useMemo(() => paths ?? [], [paths])
  const filters = useMemo(() => buildPathFilters(allPaths), [allPaths])
  const filtered = allPaths.filter((p) => matchesPathFilter(p, statusFilter))
  const shown = pathsAll ? filtered : filtered.slice(0, PATHS_PREVIEW_COUNT)
  const todayByPath = useMemo(() => new Map((today ?? []).map((t) => [t.pathId, t])), [today])
  const badgeCards = useMemo(() => (badgeProgress ? buildBadgeCards(badgeProgress) : []), [badgeProgress])

  function togglePin(card: BadgeCard) {
    const ids = card.pinned ? card.pinnedIds : card.pinBadgeId ? [card.pinBadgeId] : []
    for (const badgeId of ids) {
      pinBadge.mutate(
        { badgeId, pinned: !card.pinned },
        { onError: () => show({ message: 'Could not update your pinned badges', type: 'error' }) },
      )
    }
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = (
    <div style={{ marginBottom: 20 }}>
      <h1 style={{ margin: isPhone ? '0 0 2px' : '0 0 4px', fontSize: isPhone ? 18 : 20, fontWeight: 500, color: 'var(--text-primary)' }}>
        Learn
      </h1>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
        Grow your skills with guided paths, daily practice, and streak rewards.
      </p>
    </div>
  )

  const streakInCentre = railHidden && !badgesView && (
    <div style={{ marginTop: 20 }}>
      <LearnStreakCard variant="compact" />
    </div>
  )

  if (badgesView) {
    return (
      <div>
        {header}
        <BadgesView
          cards={badgeCards}
          filter={badgeFilter}
          onFilter={(key) => patchParams({ cat: key === 'all' ? null : key, badge: null })}
          focusKey={focusBadge}
          onBack={() => patchParams({ view: null, cat: null, badge: null }, false)}
          onTogglePin={togglePin}
          compact={isPhone}
        />
      </div>
    )
  }

  const tabs: { key: LearnTab; label: string; icon: typeof Route; count: number | undefined }[] = [
    { key: 'paths', label: 'Skill paths', icon: Route, count: paths?.length },
    { key: 'quizzes', label: 'Quizzes', icon: ListChecks, count: quizzes?.length },
  ]

  const chipRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
      <div
        className="hide-bar"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: isPhone ? 'nowrap' : 'wrap',
          overflowX: isPhone ? 'auto' : undefined,
        }}
      >
        {filters.map((f) => (
          <FilterChip key={f.key} on={statusFilter === f.key} onClick={() => patchParams({ status: f.key === 'all' ? null : f.key })}>
            {f.label} · {f.count}
          </FilterChip>
        ))}
      </div>
      {!pathsAll && (
        <button
          type="button"
          onClick={() => patchParams({ view: 'paths', tab: null }, false)}
          className="interactive-surface"
          style={{
            flexShrink: 0,
            minHeight: 32,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 12px',
            borderRadius: 'var(--r-pill)',
            background: 'transparent',
            border: 'none',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--uc-indigo-l)',
            cursor: 'pointer',
          }}
        >
          See all
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )

  return (
    <div>
      {header}

      {pathsAll ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <RoundIconButton label="Back to Learn" onClick={() => patchParams({ view: null }, false)} outlined size={isPhone ? 40 : 32}>
            <ArrowLeft size={16} />
          </RoundIconButton>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>All skill paths</h2>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{filtered.length} paths</span>
        </div>
      ) : (
        <div
          role="tablist"
          aria-label="Learn sections"
          style={{
            display: 'inline-flex',
            gap: 4,
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-pill)',
            padding: 3,
            marginBottom: 12,
          }}
        >
          {tabs.map((t) => {
            const on = tab === t.key
            const Icon = t.icon
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => patchParams({ tab: t.key === 'paths' ? null : t.key })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: isPhone ? 40 : 32,
                  padding: '0 14px',
                  borderRadius: 'var(--r-pill)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: on ? 500 : 400,
                  background: on ? 'var(--surface-card)' : 'transparent',
                  color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={14} aria-hidden="true" />
                {t.label}
                {t.count !== undefined && (
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>{t.count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {tab === 'paths' ? (
        <div role="tabpanel" aria-label="Skill paths">
          {chipRow}
          {pathsLoading ? (
            <Skeleton height={200} />
          ) : shown.length === 0 ? (
            <p style={{ margin: 0, padding: '24px 0', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              No paths here yet.
            </p>
          ) : (
            <motion.div
              key={`${statusFilter}-${pathsAll}`}
              variants={listStagger()}
              initial={prefersReducedMotion ? false : 'initial'}
              animate="animate"
              style={
                isPhone
                  ? { display: 'flex', flexDirection: 'column', gap: 10 }
                  : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }
              }
            >
              {shown.map((path) => {
                const entry = todayByPath.get(path.id)
                return (
                  <motion.div key={path.id} variants={listItem} style={{ display: 'flex' }}>
                    <PathCard
                      path={path}
                      compact={isPhone}
                      todayLeft={entry && !entry.completedToday ? 1 : 0}
                      onOpen={(id) => setOverlay({ kind: 'path', pathId: id, unitId: null })}
                    />
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      ) : (
        <div role="tabpanel" aria-label="Quizzes">
          <div style={{ marginBottom: 12 }}>
            <DailyQuizCard accent compact={isPhone} />
          </div>
          {quizzesLoading ? (
            <Skeleton height={160} />
          ) : (
            <QuizList
              quizzes={quizzes ?? []}
              compact={isPhone}
              onStart={(q) => setOverlay({ kind: 'quiz', pathId: q.pathId, unitId: q.unitId, from: null })}
              onResults={(q) => setOverlay({ kind: 'results', pathId: q.pathId, unitId: q.unitId, from: null, quizFrom: null })}
            />
          )}
          <div style={{ marginTop: 24 }}>
            <LeaderboardPanel currentUserId={user?.id} />
          </div>
        </div>
      )}

      {streakInCentre}

      {overlay?.kind === 'path' && (
        <PathDetailModal
          pathId={overlay.pathId}
          unitId={overlay.unitId}
          today={todayByPath.get(overlay.pathId)}
          onSelectUnit={(unitId) => setOverlay({ ...overlay, unitId })}
          onClose={() => setOverlay(null)}
          onStartQuiz={(unitId) => setOverlay({ kind: 'quiz', pathId: overlay.pathId, unitId, from: 'unit' })}
          onShowResults={(unitId) =>
            setOverlay({ kind: 'results', pathId: overlay.pathId, unitId, from: 'unit', quizFrom: null })
          }
        />
      )}

      {overlay?.kind === 'quiz' && (
        <QuizModal
          key={overlay.unitId}
          pathId={overlay.pathId}
          unitId={overlay.unitId}
          onClose={() => setOverlay(null)}
          onBack={
            overlay.from === 'unit'
              ? () => setOverlay({ kind: 'path', pathId: overlay.pathId, unitId: overlay.unitId })
              : undefined
          }
          onShowResults={() =>
            setOverlay({ kind: 'results', pathId: overlay.pathId, unitId: overlay.unitId, from: 'quiz', quizFrom: overlay.from })
          }
        />
      )}

      {overlay?.kind === 'results' && (
        <PastResultsModal
          pathId={overlay.pathId}
          unitId={overlay.unitId}
          onClose={() => setOverlay(null)}
          onBack={
            overlay.from === 'quiz'
              ? () => setOverlay({ kind: 'quiz', pathId: overlay.pathId, unitId: overlay.unitId, from: overlay.quizFrom })
              : overlay.from === 'unit'
                ? () => setOverlay({ kind: 'path', pathId: overlay.pathId, unitId: overlay.unitId })
                : undefined
          }
          onRetake={() =>
            setOverlay({
              kind: 'quiz',
              pathId: overlay.pathId,
              unitId: overlay.unitId,
              from: overlay.from === 'unit' ? 'unit' : overlay.from === 'quiz' ? overlay.quizFrom : null,
            })
          }
        />
      )}
    </div>
  )
}
