import { useState } from 'react'
import { ExternalLink, Trash2, Plus } from 'lucide-react'
import {
  useGroupResources,
  useCreateResource,
  useDeleteResource,
  useTrackResource,
  type GroupResource,
} from '@/features/groups'

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'notes', label: 'Notes' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'past_papers', label: 'Past Papers' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'other', label: 'Other' },
]

interface Props {
  groupId: string
  userRole?: string | null
}

export function ResourcesTab({ groupId, userRole }: Props) {
  const [activeCategory, setActiveCategory] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data, isLoading } = useGroupResources(groupId, activeCategory || undefined)
  const createMutation = useCreateResource(groupId)
  const deleteMutation = useDeleteResource(groupId)
  const trackMutation = useTrackResource(groupId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Category filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => setActiveCategory(cat.value)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 400,
                borderRadius: 'var(--r-pill)',
                border: '0.5px solid var(--border-default)',
                cursor: 'pointer',
                background: isActive ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
                color: isActive ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {cat.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 400,
            borderRadius: 'var(--r-pill)',
            border: '0.5px solid var(--border-default)',
            cursor: 'pointer',
            background: 'var(--surface-raised)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Plus size={12} strokeWidth={1.5} />
          Upload
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateResourceForm
          onSubmit={(input) => {
            createMutation.mutate(input, { onSuccess: () => setShowCreate(false) })
          }}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
        />
      )}

      {/* Resource list */}
      {isLoading ? (
        <ResourcesSkeleton />
      ) : !data?.items.length ? (
        <EmptyState text="No resources yet. Be the first to upload one!" />
      ) : (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            overflow: 'hidden',
          }}
        >
          {data.items.map((resource, idx) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              groupId={groupId}
              userRole={userRole}
              isLast={idx === data.items.length - 1}
              deleteConfirm={deleteConfirm}
              onDeleteConfirm={setDeleteConfirm}
              onDelete={() => {
                deleteMutation.mutate(resource.id, { onSuccess: () => setDeleteConfirm(null) })
              }}
              onTrack={() => trackMutation.mutate(resource.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ResourceRow({
  resource, userRole, isLast, deleteConfirm, onDeleteConfirm, onDelete, onTrack,
}: {
  resource: GroupResource
  groupId: string
  userRole?: string | null
  isLast: boolean
  deleteConfirm: string | null
  onDeleteConfirm: (id: string | null) => void
  onDelete: () => void
  onTrack: () => void
}) {
  const canDelete = userRole && ['owner', 'admin', 'moderator'].includes(userRole)

  return (
    <div
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)',
      }}
    >
      {/* Category pill */}
      <span
        style={{
          padding: '2px 8px',
          fontSize: 11,
          fontWeight: 400,
          borderRadius: 'var(--r-pill)',
          background: 'var(--uc-indigo-bg)',
          color: 'var(--uc-indigo-l)',
          flexShrink: 0,
        }}
      >
        {resource.category.replace('_', ' ')}
      </span>

      {/* Title + uploader */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {resource.title}
        </p>
        {resource.uploader && (
          <p style={{ margin: 0, fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            {resource.uploader.fullName ?? 'Unknown'} · {resource.clickCount} views
          </p>
        )}
      </div>

      {/* Open link */}
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onTrack}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 400,
          borderRadius: 'var(--r-pill)',
          border: '0.5px solid var(--border-default)',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <ExternalLink size={11} strokeWidth={1.5} />
        Open
      </a>

      {/* Delete */}
      {canDelete && (
        deleteConfirm === resource.id ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" onClick={onDelete}
              style={{ padding: '4px 8px', fontSize: 11, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--uc-orange)', background: 'var(--uc-orange-bg)', color: 'var(--uc-orange-l)', cursor: 'pointer', fontWeight: 400 }}>
              Confirm
            </button>
            <button type="button" onClick={() => onDeleteConfirm(null)}
              style={{ padding: '4px 8px', fontSize: 11, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 400 }}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => onDeleteConfirm(resource.id)}
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        )
      )}
    </div>
  )
}

function CreateResourceForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (input: { title: string; url: string; category: string; description?: string }) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('notes')
  const [description, setDescription] = useState('')

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    fontWeight: 400,
    background: 'var(--surface-raised)',
    border: '0.5px solid var(--border-default)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ title, url, category, description: description || undefined })
      }}
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} />
      <input placeholder="URL (https://...)" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required style={inputStyle} />
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
        {CATEGORIES.filter((c) => c.value).map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '6px 14px', fontSize: 13, fontWeight: 400, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          Cancel
        </button>
        <button type="submit" disabled={isPending} style={{ padding: '6px 14px', fontSize: 13, fontWeight: 400, borderRadius: 'var(--r-pill)', border: 'none', background: 'var(--uc-indigo)', color: 'var(--uc-indigo-xl)', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
          {isPending ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </form>
  )
}

function ResourcesSkeleton() {
  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ padding: '12px 16px', display: 'flex', gap: 10, borderBottom: i < 2 ? '0.5px solid var(--border-default)' : 'none' }}>
          <div style={{ width: 60, height: 20, background: 'var(--surface-raised)', borderRadius: 'var(--r-pill)' }} />
          <div style={{ flex: 1, height: 20, background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)' }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>{text}</p>
    </div>
  )
}
