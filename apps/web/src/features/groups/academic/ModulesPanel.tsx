import { useState } from 'react'
import {
  useCreateModule,
  useModules,
  useReorderModules,
  useTogglePublishModule,
} from '../hooks/useGroupExtended'

interface ModulesPanelProps {
  groupId: string
  isAdmin: boolean
}

export function ModulesPanel({ groupId, isAdmin }: ModulesPanelProps) {
  const { data: modules, isLoading } = useModules(groupId)
  const togglePublish = useTogglePublishModule(groupId)
  const reorder = useReorderModules(groupId)
  const createModule = useCreateModule(groupId)

  const [title, setTitle] = useState('')
  const [weekNumber, setWeekNumber] = useState('')
  const [description, setDescription] = useState('')

  if (isLoading || !modules) return <div>Loading modules…</div>

  const sorted = [...modules].sort((a, b) => a.displayOrder - b.displayOrder)

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sorted.length) return
    const next = [...sorted]
    const [entry] = next.splice(index, 1)
    next.splice(target, 0, entry)
    reorder.mutate(next.map((m) => m.id))
  }

  async function handleCreate() {
    if (!title.trim()) return
    await createModule.mutateAsync({
      title,
      description: description || undefined,
      weekNumber: weekNumber ? Number(weekNumber) : undefined,
      displayOrder: sorted.length + 1,
    })
    setTitle('')
    setWeekNumber('')
    setDescription('')
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {sorted.map((m, index) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-[var(--r-md)] px-3 py-3"
            style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)' }}
          >
            <div className="flex flex-col gap-1">
              <span>{m.title}</span>
              {m.description && <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{m.description}</span>}
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{m.isPublished ? 'Published' : 'Draft'}</span>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    aria-label={`Move ${m.title} up`}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="rounded-[var(--r-pill)] border-[0.5px] px-3 py-1"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${m.title} down`}
                    onClick={() => move(index, 1)}
                    disabled={index === sorted.length - 1}
                    className="rounded-[var(--r-pill)] border-[0.5px] px-3 py-1"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePublish.mutate(m.id)}
                    className="rounded-[var(--r-pill)] border-[0.5px] px-4 py-1"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
                  >
                    {m.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleCreate()
          }}
          className="flex flex-col gap-2 rounded-[var(--r-lg)] p-4"
          style={{ background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)' }}
        >
          <label className="flex flex-col gap-1">
            <span>Module title</span>
            <input
              aria-label="Module title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-[var(--r-md)] border-[0.5px] px-3 py-2"
              style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Week number</span>
            <input
              aria-label="Week number"
              type="number"
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              className="rounded-[var(--r-md)] border-[0.5px] px-3 py-2"
              style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Description</span>
            <textarea
              aria-label="Module description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-[var(--r-md)] border-[0.5px] px-3 py-2"
              style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
            />
          </label>
          <button
            type="submit"
            disabled={!title.trim()}
            className="self-start rounded-[var(--r-pill)] px-4 py-2"
            style={{ background: 'var(--uc-indigo)', color: 'var(--on-accent)' }}
          >
            Create module
          </button>
        </form>
      )}
    </div>
  )
}
