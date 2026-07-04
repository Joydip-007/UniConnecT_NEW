import { GraduationCap } from 'lucide-react'
import { usePaths, useToday, useLearningStats, StreakBanner, TodayCard } from '@/features/learning'
import { EmptyState } from '@/components/EmptyState'

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
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={GraduationCap}
            title="Nothing scheduled for today"
            description="Enroll in a path below to start building a streak."
          />
        )}
      </div>

      {/* Paths section */}
      <div>
        <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Paths
        </h2>
        {pathsLoading ? (
          <Skeleton height={200} />
        ) : paths && paths.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paths.map((path) => (
              <div
                key={path.id}
                style={{
                  background: 'var(--surface-card)',
                  border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-lg)',
                  padding: 16,
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {path.title}
                </p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
                  {path.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={GraduationCap}
            title="No learning paths yet"
            description="Check back soon — new skill paths are on the way."
          />
        )}
      </div>
    </div>
  )
}
