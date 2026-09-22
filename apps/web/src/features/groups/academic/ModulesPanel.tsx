import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Paperclip } from 'lucide-react'
import {
  useCreateModule,
  useModuleUpload,
  useModules,
  useReorderModules,
  useTogglePublishModule,
} from '../hooks/useGroupExtended'
import type { FileUrlEntry } from '../types'

const ghost = {
  padding: '4px 12px',
  fontSize: 12,
  borderRadius: 'var(--r-pill)',
  border: '0.5px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const

interface ModulesPanelProps {
  groupId: string
  isAdmin: boolean
}

export function ModulesPanel({ groupId, isAdmin }: ModulesPanelProps) {
  const { data: modules, isLoading } = useModules(groupId)
  const togglePublish = useTogglePublishModule(groupId)
  const reorder = useReorderModules(groupId)
  const createModule = useCreateModule(groupId)
  const uploadFile = useModuleUpload(groupId)

  const [title, setTitle] = useState('')
  const [weekNumber, setWeekNumber] = useState('')
  const [description, setDescription] = useState('')
  const [fileUrls, setFileUrls] = useState<FileUrlEntry[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (isLoading || !modules) return <div>Loading modules…</div>

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const uploaded = await uploadFile.mutateAsync(file)
      setFileUrls((prev) => [...prev, uploaded])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeFile(index: number) {
    setFileUrls((prev) => prev.filter((_, i) => i !== index))
  }

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
      fileUrls,
    })
    setTitle('')
    setWeekNumber('')
    setDescription('')
    setFileUrls([])
  }

  return (
    <div className="flex flex-col gap-4">
      <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {sorted.length === 0 && (
          <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>No modules yet.</p>
        )}
        {sorted.map((m, index) => (
          <div
            key={m.id}
            style={{ padding: '12px 16px', borderBottom: index === sorted.length - 1 ? 'none' : '0.5px solid var(--border-subtle)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{m.title}</div>
                {m.description && (
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{m.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: m.isPublished ? 'var(--uc-mint)' : 'var(--text-tertiary)' }}>
                  {m.isPublished ? 'Published' : 'Draft'}
                </span>
                {m.fileUrls && m.fileUrls.length > 0 && (
                  <>
                    <a
                      href={m.fileUrls[0].url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--uc-indigo-l)', textDecoration: 'none' }}
                    >
                      <Paperclip size={11} strokeWidth={1.5} />
                      Class content
                    </a>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.fileUrls.map((f) => f.name).join(', ')}
                    </span>
                  </>
                )}
              </div>
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border-subtle)' }}>
                <button type="button" aria-label={`Move ${m.title} up`} onClick={() => move(index, -1)} disabled={index === 0} style={ghost}>
                  Move up
                </button>
                <button type="button" aria-label={`Move ${m.title} down`} onClick={() => move(index, 1)} disabled={index === sorted.length - 1} style={ghost}>
                  Move down
                </button>
                <button type="button" onClick={() => togglePublish.mutate(m.id)} style={ghost}>
                  {m.isPublished ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

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
          <div className="flex flex-col gap-2">
            <span>Course materials</span>
            <input
              ref={fileInputRef}
              aria-label="Upload material"
              type="file"
              onChange={(e) => void handleFileSelected(e)}
              disabled={uploadFile.isPending}
            />
            {uploadFile.isPending && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Uploading…</span>}
            {fileUrls.length > 0 && (
              <ul className="flex flex-col gap-1">
                {fileUrls.map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2" style={{ fontSize: 12 }}>
                    <span>{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="rounded-[var(--r-pill)] border-[0.5px] px-2 py-1"
                      style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
