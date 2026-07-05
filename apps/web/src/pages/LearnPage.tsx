import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  usePaths, useToday, useLearningStats, StreakBanner, TodayCard, QuizModal, PathCard, PathDetailModal,
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
  const prefersReducedMotion = useReducedMotion()

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
              />
            ))}
            <DailyQuizCard />
            <LeaderboardPanel currentUserId={user?.id} />
          </div>
        ) : (
          <EmptyState
            icon={GraduationCap}
            title="Nothing scheduled for today"
            description="Enroll in a path below to start building a streak."
          />
        )}
      </div>

      <QuizModal unit={quizUnit} open={!!quizUnit} onClose={() => setQuizUnit(null)} />

      {/* Paths section */}
      <div>
        <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Paths
        </h2>
        {pathsLoading ? (
          <Skeleton height={200} />
        ) : paths && paths.length > 0 ? (
          <motion.div
            variants={listStagger()}
            initial={prefersReducedMotion ? false : 'initial'}
            animate="animate"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {paths.map((path) => (
              <motion.div key={path.id} variants={listItem}>
                <PathCard path={path} onOpen={setSelectedPathId} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyState
            icon={GraduationCap}
            title="No learning paths yet"
            description="Check back soon — new skill paths are on the way."
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
