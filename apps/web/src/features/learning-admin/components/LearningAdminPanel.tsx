import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Route, ListChecks } from 'lucide-react'
import type { AdminLearningPath, AdminQuiz } from '@uniconnect/shared'
import { PATHS } from '@/router/paths'
import { useAdminLearningPaths, useAdminQuizzes } from '../hooks/useLearningAdmin'
import { LearningPathLibrary } from './LearningPathLibrary'
import { LearningPathFormModal } from './LearningPathFormModal'
import { LearningPathBuilder, type BuilderSeed } from './LearningPathBuilder'
import { AdminQuizList } from './AdminQuizList'
import { AdminQuizPreviewDialog } from './AdminQuizPreviewDialog'
import { AiPathDialog, AiQuizDialog, NewQuizDialog } from './LearningAiDialogs'
import { StatGrid, type StatSpec } from './learningAdminUi'

type Tab = 'paths' | 'quizzes'
type Dialog = 'ai-path' | 'ai-quiz' | 'new-quiz' | null

/** The stat row for each tab — same four-card grid, different payload. */
function pathStats(paths: AdminLearningPath[]): StatSpec[] {
  const published = paths.filter((p) => p.isPublished).length
  const enrolled = paths.reduce((s, p) => s + p.enrolledCount, 0)
  const done = paths.length ? Math.round((paths.reduce((s, p) => s + p.completionRate, 0) / paths.length) * 100) : 0
  return [
    { label: 'Learning paths', value: String(paths.length), sub: `${published} published` },
    { label: 'Total enrolled', value: enrolled.toLocaleString(), sub: 'across all paths' },
    { label: 'Avg completion', value: `${done}%`, sub: 'of enrolled units' },
    { label: 'Awaiting review', value: String(paths.length - published), sub: 'draft paths' },
  ]
}

function quizStats(quizzes: AdminQuiz[]): StatSpec[] {
  const live = quizzes.filter((q) => q.status === 'published')
  const attempts = quizzes.reduce((s, q) => s + q.attempts, 0)
  const scored = live.filter((q) => q.avgScore !== null)
  const avg = scored.length ? Math.round(scored.reduce((s, q) => s + (q.avgScore ?? 0), 0) / scored.length) : 0
  return [
    { label: 'Quizzes', value: String(quizzes.length), sub: `${live.length} published` },
    { label: 'Attempts', value: attempts.toLocaleString(), sub: 'across all quizzes' },
    { label: 'Avg score', value: `${avg}%`, sub: 'on published quizzes' },
    {
      label: 'Awaiting review',
      value: String(quizzes.filter((q) => q.status === 'draft' || q.status === 'needs_review').length),
      sub: 'drafts and AI output',
    },
  ]
}

/**
 * Admin → Learning. A pill tab strip (Learning paths / Quizzes), a four-card stat
 * row, then the tab body. The AI schedule preferences live inside the two AI dialogs. "New learning path" and "Generate draft" swap
 * the whole column for the builder, exactly as the design does.
 */
export function LearningAdminPanel() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('paths')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [builder, setBuilder] = useState<{ seed: BuilderSeed | null } | null>(null)
  const [editing, setEditing] = useState<AdminLearningPath | null>(null)
  const [preview, setPreview] = useState<AdminQuiz | null>(null)

  const { data: paths = [], isLoading: pathsLoading } = useAdminLearningPaths({ status: 'all' })
  const { data: quizzes = [], isLoading: quizzesLoading } = useAdminQuizzes()

  const manage = (pathId: string) => navigate(PATHS.ADMIN_LEARNING_PATH(pathId))

  // Row actions on the Quizzes tab. A quiz that lives on a path is managed on that
  // path's Manage screen; daily-quiz rows have no path, so their primary opens the
  // questions view (a batch awaiting review gets Approve / Discard there).
  function quizPrimary(q: AdminQuiz) {
    if (q.pathId) manage(q.pathId)
    else setPreview(q)
  }

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'paths', label: 'Learning paths', icon: <Route size={14} /> },
    { key: 'quizzes', label: 'Quizzes', icon: <ListChecks size={14} /> },
  ]

  if (builder) {
    return (
      <>
        <LearningPathBuilder seed={builder.seed} onExit={() => setBuilder(null)} onDraftWithAi={() => setDialog('ai-path')} />
        <AiPathDialog
          open={dialog === 'ai-path'}
          onClose={() => setDialog(null)}
          onGenerated={(draft, department) => {
            setDialog(null)
            setBuilder({ seed: { draft, department } })
          }}
        />
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        role="tablist"
        aria-label="Learning sections"
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-pill)',
          alignSelf: 'flex-start',
          maxWidth: '100%',
          overflowX: 'auto',
        }}
      >
        {tabs.map((t) => {
          const on = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 13,
                fontWeight: 500,
                padding: '7px 16px',
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                background: on ? 'var(--surface-card)' : 'transparent',
                border: `0.5px solid ${on ? 'var(--border-hover)' : 'transparent'}`,
                color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          )
        })}
      </div>

      <StatGrid stats={tab === 'paths' ? pathStats(paths) : quizStats(quizzes)} />

      {tab === 'paths' && (
        <LearningPathLibrary
          paths={paths}
          isLoading={pathsLoading}
          onCreatePath={() => setBuilder({ seed: null })}
          onDraftWithAi={() => setDialog('ai-path')}
          onEditPath={setEditing}
          onManagePath={manage}
        />
      )}

      {tab === 'quizzes' && (
        <AdminQuizList
          quizzes={quizzes}
          isLoading={quizzesLoading}
          onGenerateWithAi={() => setDialog('ai-quiz')}
          onNewQuiz={() => setDialog('new-quiz')}
          onSecondary={setPreview}
          onPrimary={quizPrimary}
        />
      )}

      <LearningPathFormModal mode="edit" path={editing} open={editing !== null} onClose={() => setEditing(null)} />
      <AiPathDialog
        open={dialog === 'ai-path'}
        onClose={() => setDialog(null)}
        onGenerated={(draft, department) => {
          setDialog(null)
          setBuilder({ seed: { draft, department } })
        }}
      />
      <AiQuizDialog open={dialog === 'ai-quiz'} paths={paths} onClose={() => setDialog(null)} />
      <NewQuizDialog open={dialog === 'new-quiz'} paths={paths} onClose={() => setDialog(null)} />
      <AdminQuizPreviewDialog quiz={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
