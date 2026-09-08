import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GripVertical, Trash2, ArrowLeft } from 'lucide-react'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { usePathDetail, useCreatePathUnit, useUpdatePathUnit, useDeletePathUnit, useReorderPathUnits } from '../hooks/useLearningAdmin'

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-page)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-md)',
  padding: '8px 10px', color: 'var(--text-primary)', fontSize: 13,
}

export function LearningPathManagePage() {
  const { pathId } = useParams<{ pathId: string }>()
  const navigate = useNavigate()
  const { data: path, isLoading } = usePathDetail(pathId ?? null)
  const createUnit = useCreatePathUnit(pathId ?? '')
  const updateUnit = useUpdatePathUnit(pathId ?? '')
  const deleteUnit = useDeletePathUnit(pathId ?? '')
  const reorderUnits = useReorderPathUnits(pathId ?? '')
  const [newUnitTitle, setNewUnitTitle] = useState('')
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)

  if (isLoading || !path) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>

  function moveUnit(index: number, direction: -1 | 1) {
    if (!path) return
    const ids = path.units.map((u) => u.id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorderUnits.mutate(ids)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <GhostBtn onClick={() => navigate(PATHS.ADMIN + '?tab=learning')} style={{ padding: 6 }}>
          <ArrowLeft size={16} />
        </GhostBtn>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>{path.title}</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            {path.unitCount} units · {path.enrolledCount} enrolled
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {path.units.map((unit, i) => (
          <div
            key={unit.id}
            style={{
              background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-md)',
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <GripVertical size={14} color="var(--text-tertiary)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
              {editingUnitId === unit.id ? (
                <input
                  autoFocus
                  style={{ ...inputStyle, fontSize: 14, fontWeight: 500 }}
                  defaultValue={unit.title}
                  aria-label={`Unit ${i + 1} title`}
                  onBlur={(e) => {
                    updateUnit.mutate({ unitId: unit.id, patch: { title: e.target.value } })
                    setEditingUnitId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingUnitId(unit.id)}
                  aria-label={`Edit unit ${i + 1} title`}
                  style={{
                    background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer',
                    font: 'inherit', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
                  }}
                >
                  {unit.title}
                </button>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{unit.type}</span>
            </div>
            <GhostBtn onClick={() => moveUnit(i, -1)} disabled={i === 0} style={{ padding: 4 }}>↑</GhostBtn>
            <GhostBtn onClick={() => moveUnit(i, 1)} disabled={i === path.units.length - 1} style={{ padding: 4 }}>↓</GhostBtn>
            <button
              type="button"
              onClick={() => deleteUnit.mutate(unit.id)}
              aria-label={`Delete unit ${unit.title}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label htmlFor="new-unit-title" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
          New unit title
        </label>
        <input
          id="new-unit-title"
          style={{ ...inputStyle, flex: 1 }}
          placeholder="New unit title"
          value={newUnitTitle}
          onChange={(e) => setNewUnitTitle(e.target.value)}
        />
        <PrimaryBtn
          onClick={() => {
            createUnit.mutate({ title: newUnitTitle, type: 'read', content: { body: '' } }, { onSuccess: () => setNewUnitTitle('') })
          }}
          disabled={!newUnitTitle.trim() || createUnit.isPending}
        >
          Add unit
        </PrimaryBtn>
      </div>
    </div>
  )
}
