import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Sparkles, Plus, BookOpen, Binary, Briefcase, Mic, FlaskConical, GraduationCap } from 'lucide-react'
import type { AdminLearningPath } from '@uniconnect/shared'
import { Chip, ChipRow, IconTile, ProgressBar, SmallBtn, StatusPill } from './learningAdminUi'
import { cardStyle, capitalise } from './learningAdminUi.styles'

/** Category → tile glyph. The design gives each card an icon; paths have no icon column, so the category picks one. */
const CATEGORY_ICON: Record<string, typeof Binary> = {
  technical: Binary,
  career: Briefcase,
  communication: Mic,
  research: FlaskConical,
}

type Filter = 'all' | 'published' | 'draft' | { category: string }

interface Props {
  paths: AdminLearningPath[]
  isLoading: boolean
  onCreatePath: () => void
  onDraftWithAi: () => void
  onEditPath: (path: AdminLearningPath) => void
  onManagePath: (pathId: string) => void
}

/** "Learning paths" tab: filter chips, the two create actions, and the two-column card grid. */
export function LearningPathLibrary({ paths, isLoading, onCreatePath, onDraftWithAi, onEditPath, onManagePath }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const categories = useMemo(() => [...new Set(paths.map((p) => p.category).filter(Boolean))], [paths])

  const visible = paths.filter((p) => {
    if (filter === 'all') return true
    if (filter === 'published') return p.isPublished
    if (filter === 'draft') return !p.isPublished
    return p.category === filter.category
  })

  const publishedCount = paths.filter((p) => p.isPublished).length
  const isCat = (c: string) => typeof filter === 'object' && filter.category === c

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <ChipRow>
          <Chip label={`All ${paths.length}`} active={filter === 'all'} onClick={() => setFilter('all')} />
          <Chip label={`Published ${publishedCount}`} active={filter === 'published'} onClick={() => setFilter('published')} />
          <Chip label={`Drafts ${paths.length - publishedCount}`} active={filter === 'draft'} onClick={() => setFilter('draft')} />
          {categories.map((c) => (
            <Chip
              key={c}
              label={`${capitalise(c)} ${paths.filter((p) => p.category === c).length}`}
              active={isCat(c)}
              onClick={() => setFilter({ category: c })}
            />
          ))}
        </ChipRow>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <SmallBtn tone="tint" size="bar" onClick={onDraftWithAi} icon={<Sparkles size={14} />}>
            Draft with AI
          </SmallBtn>
          <SmallBtn tone="solid" size="bar" onClick={onCreatePath} icon={<Plus size={14} />}>
            New learning path
          </SmallBtn>
        </div>
      </div>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Loading…</p>
      ) : visible.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: '48px 0', fontSize: 13 }}>
          <BookOpen size={20} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0 }}>No learning paths match this filter.</p>
        </div>
      ) : (
        <div className="learn-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {visible.map((p) => {
            const Icon = CATEGORY_ICON[p.category] ?? GraduationCap
            const pct = Math.round(p.completionRate * 100)
            return (
              <article
                key={p.id}
                className="learn-path-card"
                style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <IconTile size={42}>
                    <Icon size={19} />
                  </IconTile>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {p.title}
                      </span>
                      {p.isPublished ? (
                        <StatusPill label="Published" color="var(--uc-mint)" bg="var(--uc-mint-bg)" bdr="var(--uc-mint-bdr)" />
                      ) : (
                        <StatusPill label="Draft" color="var(--text-secondary)" bg="var(--surface-raised)" bdr="var(--border-default)" />
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      {[p.department, `${p.unitCount} units`, capitalise(p.difficulty)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.enrolledCount.toLocaleString()} enrolled</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{pct}% avg completion</span>
                  </div>
                  <ProgressBar pct={pct} height={6} />
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 12, borderTop: '0.5px solid var(--border-default)' }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <SmallBtn tone="ghost" onClick={() => onEditPath(p)}>
                      Edit
                    </SmallBtn>
                    <SmallBtn tone="tint" onClick={() => onManagePath(p.id)}>
                      Manage
                    </SmallBtn>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
