import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ListChecks, WandSparkles, Plus } from 'lucide-react'
import type { AdminQuiz, AdminQuizStatus } from '@uniconnect/shared'
import { QUIZ_STATUS, quizSourceLabel } from './quizStatus'
import { Chip, ChipRow, IconTile, ProgressBar, SmallBtn, StatusPill } from './learningAdminUi'
import { cardStyle } from './learningAdminUi.styles'

type Filter = 'all' | AdminQuizStatus

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'scheduled', label: 'Scheduled' },
]

interface Props {
  quizzes: AdminQuiz[]
  isLoading: boolean
  onGenerateWithAi: () => void
  onNewQuiz: () => void
  /** "Results" (live) / "Preview" (not live) — the read-only questions view. */
  onSecondary: (quiz: AdminQuiz) => void
  /** "Manage" (live) / "Continue draft" (not live). */
  onPrimary: (quiz: AdminQuiz) => void
}

/** "Quizzes" tab: status filters, the two create actions, and the single-card row list. */
export function AdminQuizList({ quizzes, isLoading, onGenerateWithAi, onNewQuiz, onSecondary, onPrimary }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const visible = quizzes.filter((q) => filter === 'all' || q.status === filter)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={`${f.label} ${f.key === 'all' ? quizzes.length : quizzes.filter((q) => q.status === f.key).length}`}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
            />
          ))}
        </ChipRow>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <SmallBtn tone="tint" size="bar" onClick={onGenerateWithAi} icon={<WandSparkles size={14} />}>
            Generate with AI
          </SmallBtn>
          <SmallBtn tone="solid" size="bar" onClick={onNewQuiz} icon={<Plus size={14} />}>
            New quiz
          </SmallBtn>
        </div>
      </div>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Loading…</p>
      ) : visible.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: '48px 0', fontSize: 13 }}>
          <ListChecks size={20} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0 }}>No quizzes match this filter.</p>
        </div>
      ) : (
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          {visible.map((q) => {
            const s = QUIZ_STATUS[q.status]
            const live = q.status === 'published'
            const passed = q.avgScore !== null && q.avgScore >= q.passMark
            return (
              <div
                key={`${q.kind}:${q.id}`}
                className="learn-quiz-row"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '0.5px solid var(--border-default)' }}
              >
                <IconTile size={38}>
                  <ListChecks size={18} />
                </IconTile>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {q.title}
                    </span>
                    <StatusPill label={s.label} color={s.color} bg={s.bg} bdr={s.bdr} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {q.pathTitle} · {q.questionCount} questions · pass {q.passMark}%
                  </div>
                </div>
                <div className="learn-quiz-meter" style={{ flex: '0 1 150px', minWidth: 96, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {live ? `${q.attempts.toLocaleString()} attempts` : 'Not live yet'}
                  </span>
                  <ProgressBar
                    pct={live ? (q.avgScore ?? 0) : 0}
                    height={5}
                    color={live ? (passed ? 'var(--uc-mint)' : 'var(--uc-amber-l)') : 'var(--border-default)'}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {live ? `Avg score ${q.avgScore ?? 0}%` : quizSourceLabel(q)}
                  </span>
                </div>
                <span className="learn-quiz-updated" style={{ flex: '0 1 92px', minWidth: 64, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {formatDistanceToNow(new Date(q.updatedAt), { addSuffix: true })}
                </span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <SmallBtn tone="ghost" onClick={() => onSecondary(q)}>
                    {live ? 'Results' : 'Preview'}
                  </SmallBtn>
                  <SmallBtn tone="tint" onClick={() => onPrimary(q)}>
                    {live ? 'Manage' : 'Continue draft'}
                  </SmallBtn>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
