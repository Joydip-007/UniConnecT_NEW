import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Sparkles, Wand2, Plus, BookOpen } from 'lucide-react'
import { PrimaryBtn, GhostBtn } from '@/components/Button'
import { usePendingPaths } from '../hooks/useLearningAdmin'
import { useAdminLearningPaths, useSetPathPublished, useTriggerLearningGenerate } from '../hooks/useLearningAdmin'

const card: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
  padding: 20,
}

const statTile: React.CSSProperties = { ...card, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em' }

type StatusFilter = 'all' | 'published' | 'draft'

interface Props {
  onCreatePath: () => void
  onEditPath: (pathId: string) => void
  onManagePath: (pathId: string) => void
}

export function LearningPathLibrary({ onCreatePath, onEditPath, onManagePath }: Props) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState<string | null>(null)
  const { data: paths, isLoading } = useAdminLearningPaths({ status, category: category ?? undefined })
  const { data: allPaths } = useAdminLearningPaths({ status: 'all' })
  const { data: pendingPaths } = usePendingPaths()
  const setPublished = useSetPathPublished()
  const triggerGenerate = useTriggerLearningGenerate()

  const categories = useMemo(() => {
    const set = new Set((allPaths ?? []).map((p) => p.category).filter(Boolean))
    return [...set]
  }, [allPaths])

  const totalPaths = allPaths?.length ?? 0
  const publishedCount = allPaths?.filter((p) => p.isPublished).length ?? 0
  const draftCount = totalPaths - publishedCount
  const totalEnrolled = (allPaths ?? []).reduce((sum, p) => sum + p.enrolledCount, 0)
  const avgCompletion = totalPaths > 0
    ? Math.round(((allPaths ?? []).reduce((sum, p) => sum + p.completionRate, 0) / totalPaths) * 100)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button
          type="button"
          onClick={() => triggerGenerate.mutate('learning')}
          disabled={triggerGenerate.isPending}
          style={{ ...card, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', border: '0.5px solid var(--uc-indigo-bdr)', background: 'var(--uc-indigo-bg)' }}
        >
          <Sparkles size={18} color="var(--uc-indigo-l)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Generate a learning path with AI</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Describe a topic and get a structured, unit-by-unit path draft.</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => triggerGenerate.mutate('quiz')}
          disabled={triggerGenerate.isPending}
          style={{ ...card, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', border: '0.5px solid var(--uc-indigo-bdr)', background: 'var(--uc-indigo-bg)' }}
        >
          <Wand2 size={18} color="var(--uc-indigo-l)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Generate a quiz with AI</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Build a checkpoint quiz from any path's units in seconds.</p>
          </div>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={statTile}>
          <span style={labelStyle}>Learning paths</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)' }}>{totalPaths}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{publishedCount} published</span>
        </div>
        <div style={statTile}>
          <span style={labelStyle}>Total enrolled</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)' }}>{totalEnrolled.toLocaleString()}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>across all paths</span>
        </div>
        <div style={statTile}>
          <span style={labelStyle}>Avg completion</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)' }}>{avgCompletion}%</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>of enrolled units</span>
        </div>
        <div style={statTile}>
          <span style={labelStyle}>Awaiting review</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)' }}>{pendingPaths?.length ?? 0}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>draft paths</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <FilterChip label={`All ${totalPaths}`} active={status === 'all' && !category} onClick={() => { setStatus('all'); setCategory(null) }} />
        <FilterChip label={`Published ${publishedCount}`} active={status === 'published'} onClick={() => { setStatus('published'); setCategory(null) }} />
        <FilterChip label={`Drafts ${draftCount}`} active={status === 'draft'} onClick={() => { setStatus('draft'); setCategory(null) }} />
        {categories.map((c) => (
          <FilterChip
            key={c}
            label={`${c[0].toUpperCase()}${c.slice(1)} ${(allPaths ?? []).filter((p) => p.category === c).length}`}
            active={category === c}
            onClick={() => { setCategory(c); setStatus('all') }}
          />
        ))}
        <div style={{ flex: 1 }} />
        <PrimaryBtn onClick={onCreatePath} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New learning path
        </PrimaryBtn>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : !paths || paths.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--text-tertiary)', padding: '48px 0' }}>
          <BookOpen size={20} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0 }}>No learning paths match this filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {paths.map((p) => (
            <div key={p.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{p.title}</span>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 'var(--r-pill)',
                        background: p.isPublished ? 'var(--uc-mint-bg)' : 'var(--uc-amber-bg)',
                        color: p.isPublished ? 'var(--uc-mint)' : 'var(--uc-amber-l)',
                        border: `0.5px solid ${p.isPublished ? 'var(--uc-mint-bdr)' : 'var(--uc-amber-bdr)'}`,
                      }}
                    >
                      {p.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {[p.department, `${p.unitCount} units`, p.difficulty].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>{p.enrolledCount} enrolled</span>
                <span>{Math.round(p.completionRate * 100)}% avg completion</span>
              </div>
              <div style={{ height: 4, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(p.completionRate * 100)}%`, background: 'var(--uc-indigo)', borderRadius: 'var(--r-pill)' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <GhostBtn onClick={() => onEditPath(p.id)} style={{ fontSize: 12, padding: '4px 12px' }}>Edit</GhostBtn>
                  <PrimaryBtn onClick={() => onManagePath(p.id)} style={{ fontSize: 12, padding: '4px 12px' }}>Manage</PrimaryBtn>
                </div>
              </div>
              {!p.isPublished && (
                <GhostBtn
                  onClick={() => setPublished.mutate({ pathId: p.id, isPublished: true })}
                  disabled={setPublished.isPending}
                  style={{ fontSize: 12, alignSelf: 'flex-start' }}
                >
                  Publish
                </GhostBtn>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        borderRadius: 'var(--r-pill)',
        border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
        background: active ? 'var(--uc-indigo-bg)' : 'transparent',
        color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
