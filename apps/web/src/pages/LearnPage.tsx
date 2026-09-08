import { useMemo, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  usePaths, useToday, useLearningStats, StreakBanner, TodayCard, QuizModal, PathCard, PathDetailModal,
  buildPathFilters, defaultFilterKey,
} from '@/features/learning'
import { DailyQuizCard, LeaderboardPanel } from '@/features/quiz'
import { useAuthStore } from '@/stores/authStore'
import type { LearningUnit } from '@/features/learning'
import { EmptyState } from '@/components/EmptyState'
import { listStagger, listItem } from '@/lib/motion'

function Skeleton({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 'var(--r-lg)',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
      }}
    />
  )
}

export default function LearnPage() {
  const { data: stats, isLoading: statsLoading } = useLearningStats()
  const { data: today, isLoading: todayLoading } = useToday()
  const { data: paths, isLoading: pathsLoading } = usePaths()
  const user = useAuthStore((s) => s.user)
  const [quizUnit, setQuizUnit] = useState<LearningUnit | null>(null)
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  const [filterKey, setFilterKey] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()

  const filters = useMemo(() => buildPathFilters(paths ?? []), [paths])
  // The catalogue arrives after the first render, so the chip only settles once it exists;
  // a chip that disappears (the last path in a category is abandoned) falls back to "All".
  const activeKey = filters.some((f) => f.key === filterKey)
    ? (filterKey as string)
    : defaultFilterKey(filters)
  const activeFilter = filters.find((f) => f.key === activeKey)
  const visiblePaths = (paths ?? []).filter((p) => (activeFilter ? activeFilter.matches(p) : true))

  // Exactly one filled accent on the screen: the first thing in Today that still needs doing.
  // The daily quiz inherits it only when every scheduled unit is already done.
  const leadUnitId = today?.find((entry) => !entry.completedToday)?.unit.id ?? null

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: '0 0 4px',
            fontSize: 20,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          Learn
        </h1>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
          Grow your skills with guided paths, daily practice, and streak rewards.
        </p>
      </div>

      {/* Streak header slot */}
      <div style={{ marginBottom: 20 }}>
        {statsLoading ? (
          <Skeleton height={72} />
        ) : stats ? (
          <StreakBanner stats={stats} />
        ) : null}
      </div>

      {/* Today section */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Today
        </h2>
        {todayLoading ? (
          <Skeleton height={96} />
        ) : today && today.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {today.map((entry) => (
              <TodayCard
                key={entry.unit.id}
                entry={entry}
                pathTitle={paths?.find((p) => p.id === entry.pathId)?.title}
                onQuizStart={setQuizUnit}
                isLead={entry.unit.id === leadUnitId}
              />
            ))}
            <DailyQuizCard accent={leadUnitId === null} />
            <LeaderboardPanel currentUserId={user?.id} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <EmptyState
              icon={GraduationCap}
              title="Nothing scheduled for today"
              description="Enroll in a path below to start building a streak."
            />
            <DailyQuizCard accent />
            <LeaderboardPanel currentUserId={user?.id} />
          </div>
        )}
      </div>

      <QuizModal unit={quizUnit} open={!!quizUnit} onClose={() => setQuizUnit(null)} />

      {/* Paths section */}
      <div>
        <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Paths
        </h2>

        {filters.length > 2 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {filters.map((filter) => {
              const on = filter.key === activeKey
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setFilterKey(filter.key)}
                  aria-pressed={on}
                  style={{
                    minHeight: 32,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    borderRadius: 'var(--r-pill)',
                    background: on ? 'var(--uc-indigo-bg)' : 'var(--surface-card)',
                    border: `0.5px solid ${on ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                    fontSize: 12,
                    fontWeight: 500,
                    color: on ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {filter.label} · {filter.count}
                </button>
              )
            })}
          </div>
        )}

        {pathsLoading ? (
          <Skeleton height={200} />
        ) : visiblePaths.length > 0 ? (
          <motion.div
            key={activeKey}
            variants={listStagger()}
            initial={prefersReducedMotion ? false : 'initial'}
            animate="animate"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {visiblePaths.map((path) => (
              <motion.div key={path.id} variants={listItem}>
                <PathCard path={path} onOpen={setSelectedPathId} />
              </motion.div>
            ))}
          </motion.div>
        ) : paths && paths.length > 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Nothing in this filter"
            description="Pick another chip to see the rest of the catalogue."
          />
        ) : (
          <EmptyState
            icon={GraduationCap}
            title="No learning paths yet"
            description="Check back soon. New skill paths are on the way."
          />
        )}
      </div>

      <PathDetailModal
        pathId={selectedPathId}
        open={!!selectedPathId}
        onClose={() => setSelectedPathId(null)}
      />
    </div>
  )
}
