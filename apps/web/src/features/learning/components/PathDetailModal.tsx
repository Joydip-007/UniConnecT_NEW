import { Check, Lock } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useToastStore } from '@/stores/toastStore'
import { usePath, useEnroll, useAbandon } from '../hooks/useLearning'
import type { LearningUnit } from '../types'

interface PathDetailModalProps {
  pathId: string | null
  open: boolean
  onClose: () => void
}

function unitState(unit: LearningUnit, nextUnlockedId: string | undefined): 'completed' | 'next' | 'locked' {
  if (unit.completed) return 'completed'
  if (unit.id === nextUnlockedId) return 'next'
  return 'locked'
}

function UnitRow({ unit, state }: { unit: LearningUnit; state: 'completed' | 'next' | 'locked' }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 'var(--r-md)',
        border: `0.5px solid ${state === 'next' ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
        background: state === 'next' ? 'var(--uc-indigo-bg)' : 'var(--surface-card)',
      }}
    >
      {state === 'completed' && <Check size={15} style={{ color: 'var(--uc-mint)', flexShrink: 0 }} aria-hidden="true" />}
      {state === 'locked' && <Lock size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} aria-hidden="true" />}
      {state === 'next' && (
        <span
          style={{
            width: 15,
            height: 15,
            borderRadius: '50%',
            border: '1.5px solid var(--uc-indigo-l)',
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontSize: 13,
          fontWeight: state === 'next' ? 500 : 400,
          color: state === 'locked' ? 'var(--text-tertiary)' : 'var(--text-primary)',
        }}
      >
        {unit.title}
      </span>
    </div>
  )
}

export function PathDetailModal({ pathId, open, onClose }: PathDetailModalProps) {
  const { data: path } = usePath(pathId)
  const enroll = useEnroll()
  const abandon = useAbandon()
  const show = useToastStore((s) => s.show)

  const units = path?.units ?? []
  const nextUnlocked = units.find((u) => !u.completed)

  function handleEnroll() {
    if (!pathId) return
    enroll.mutate(pathId, {
      onSuccess: () => {
        show({ message: 'Enrolled — your first unit is ready', type: 'success' })
      },
    })
  }

  function handleAbandon() {
    if (!pathId) return
    const id = pathId
    abandon.mutate(id, {
      onSuccess: () => {
        show({ message: 'Path abandoned', onUndo: () => enroll.mutate(id) })
      },
    })
  }

  if (!path) {
    return (
      <Modal isOpen={open} onClose={onClose} title="Path">
        <div />
      </Modal>
    )
  }

  const status = path.enrollment?.status ?? null

  return (
    <Modal isOpen={open} onClose={onClose} title={path.title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {path.description}
        </p>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          {path.unitCount} units · ~{path.estimated_days} days · {path.difficulty}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {units.map((unit) => (
            <UnitRow key={unit.id} unit={unit} state={unitState(unit, nextUnlocked?.id)} />
          ))}
        </div>

        {status === 'completed' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--uc-mint)',
                background: 'var(--uc-mint-bg)',
                border: '0.5px solid var(--uc-mint-bdr)',
                borderRadius: 'var(--r-pill)',
                padding: '3px 10px',
              }}
            >
              Completed
            </span>
            {path.badge_name && (
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--uc-amber-l)' }}>
                Badge earned: {path.badge_name}
              </span>
            )}
          </div>
        ) : status === 'active' ? (
          <button
            type="button"
            onClick={handleAbandon}
            disabled={abandon.isPending}
            className="press-feedback"
            style={{
              alignSelf: 'flex-start',
              background: 'none',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              opacity: abandon.isPending ? 0.6 : 1,
            }}
          >
            Abandon path
          </button>
        ) : (
          <button
            type="button"
            onClick={handleEnroll}
            disabled={enroll.isPending}
            className="press-feedback"
            style={{
              alignSelf: 'flex-start',
              background: 'var(--uc-orange)',
              color: 'var(--uc-orange-l)',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              opacity: enroll.isPending ? 0.6 : 1,
            }}
          >
            Enroll
          </button>
        )}
      </div>
    </Modal>
  )
}
