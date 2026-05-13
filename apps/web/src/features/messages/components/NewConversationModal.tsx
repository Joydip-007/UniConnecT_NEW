import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { api } from '@/lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserResult {
  id: string
  fullName: string
  role: 'student' | 'alumni' | 'staff' | 'admin'
  profile: {
    avatarUrl: string | null
    headline: string | null
    department: string | null
  }
}

interface CreateConversationBody {
  participantIds: string[]
  name?: string
}

interface CreatedConversation {
  id: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'var(--uc-indigo)',
  '#2E7D8C',
  '#6B4E9B',
  '#1A6B4A',
  '#8C4A2E',
]

function seedColor(seed: string): string {
  const sum = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

type BadgeVariant = 'dept' | 'alumni' | 'neutral'

const ROLE_BADGE: Record<UserResult['role'], BadgeVariant> = {
  student: 'dept',
  alumni: 'alumni',
  staff: 'neutral',
  admin: 'neutral',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 13,
  fontWeight: 400,
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 150ms',
}

function focusBorder(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}
function blurBorder(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

// ── UserResultRow ─────────────────────────────────────────────────────────────

function UserResultRow({
  user,
  onClick,
}: {
  user: UserResult
  onClick: () => void
}) {
  const subtitle = user.profile.department ?? user.profile.headline

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Avatar initials={initials(user.fullName)} color={seedColor(user.id)} size={34} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.fullName}
          </span>
          <Badge variant={ROLE_BADGE[user.role]}>{user.role}</Badge>
        </div>
        {subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </button>
  )
}

// ── SelectedChip ──────────────────────────────────────────────────────────────

function SelectedChip({ user, onRemove }: { user: UserResult; onRemove: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px 3px 5px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--uc-indigo-bg)',
        border: '0.5px solid var(--uc-indigo-bdr)',
        fontSize: 12,
        fontWeight: 400,
        color: 'var(--uc-indigo-l)',
        maxWidth: 160,
      }}
    >
      <Avatar initials={initials(user.fullName)} color={seedColor(user.id)} size={18} />
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {user.fullName}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${user.fullName}`}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 0,
          color: 'var(--uc-indigo-l)',
          flexShrink: 0,
          opacity: 0.7,
        }}
      >
        <X size={11} strokeWidth={2} />
      </button>
    </span>
  )
}

// ── NewConversationModal ──────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export function NewConversationModal({ onClose }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const overlayRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([])
  const [groupName, setGroupName] = useState('')

  const isGroup = selectedUsers.length > 1

  // Debounce search query (300 ms)
  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('')
      return
    }
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Escape key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // User search
  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ['users', 'search', debouncedQuery],
    queryFn: () =>
      api
        .get<{ data: UserResult[] }>('/users/search', { params: { q: debouncedQuery } })
        .then((r) => r.data.data),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  // Filter out already-selected users so the list stays clean
  const selectedIds = new Set(selectedUsers.map((u) => u.id))
  const filteredResults = (searchData ?? []).filter((u) => !selectedIds.has(u.id))

  // Create conversation
  const createMutation = useMutation({
    mutationFn: (body: CreateConversationBody) =>
      api
        .post<{ data: CreatedConversation }>('/conversations', body)
        .then((r) => r.data.data),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      navigate(`/messages/${conv.id}`)
      onClose()
    },
  })

  function toggleUser(user: UserResult) {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user],
    )
  }

  function handleCreate() {
    if (selectedUsers.length === 0) return
    createMutation.mutate({
      participantIds: selectedUsers.map((u) => u.id),
      ...(isGroup && groupName.trim() ? { name: groupName.trim() } : {}),
    })
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  const canCreate =
    selectedUsers.length > 0 &&
    (!isGroup || groupName.trim().length > 0) &&
    !createMutation.isPending

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,13,26,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '0 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            New conversation
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-tertiary)',
              lineHeight: 0,
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Selected chips ────────────────────────────────────────────────── */}
        {selectedUsers.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: '8px 10px',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              minHeight: 40,
            }}
          >
            {selectedUsers.map((user) => (
              <SelectedChip
                key={user.id}
                user={user}
                onRemove={() => toggleUser(user)}
              />
            ))}
          </div>
        )}

        {/* ── Search input ──────────────────────────────────────────────────── */}
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            strokeWidth={1.5}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }}
          />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={focusBorder}
            onBlur={blurBorder}
            placeholder="Search classmates and alumni…"
            style={{ ...inputStyle, paddingLeft: 34 }}
          />
          {isSearching && (
            <Loader2
              size={14}
              strokeWidth={1.5}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
                animation: 'spin 1s linear infinite',
              }}
            />
          )}
        </div>

        {/* ── Results ──────────────────────────────────────────────────────── */}
        <div
          style={{
            minHeight: 80,
            maxHeight: 248,
            overflowY: 'auto',
            margin: '0 -4px',
            padding: '0 4px',
          }}
        >
          {debouncedQuery.length < 2 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '24px 0',
                color: 'var(--text-tertiary)',
              }}
            >
              <Users size={22} strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: 12, fontWeight: 400, textAlign: 'center' }}>
                Search for classmates and alumni to start a conversation.
              </p>
            </div>
          ) : !isSearching && filteredResults.length === 0 ? (
            <p
              style={{
                margin: '20px 0',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
                textAlign: 'center',
              }}
            >
              No users found for &ldquo;{debouncedQuery}&rdquo;
            </p>
          ) : (
            filteredResults.map((user) => (
              <UserResultRow key={user.id} user={user} onClick={() => toggleUser(user)} />
            ))
          )}
        </div>

        {/* ── Group name input (only when 2+ selected) ──────────────────────── */}
        {isGroup && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="newConvGroupName"
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
            >
              Group name
            </label>
            <input
              id="newConvGroupName"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onFocus={focusBorder}
              onBlur={blurBorder}
              placeholder={`${selectedUsers.map((u) => u.fullName.split(' ')[0]).join(', ')}'s group`}
              maxLength={60}
              style={inputStyle}
            />
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <GhostBtn type="button" onClick={onClose}>
            Cancel
          </GhostBtn>
          <PrimaryBtn type="button" disabled={!canCreate} onClick={handleCreate}>
            {createMutation.isPending
              ? 'Starting…'
              : isGroup
                ? 'Create group'
                : 'Start conversation'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  )
}
