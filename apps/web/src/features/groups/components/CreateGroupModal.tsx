import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Check, FileUp, GraduationCap, Search, Users } from 'lucide-react'
import { api } from '@/lib/axios'
import { Modal } from '@/components/Modal'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { ImageUploadField } from '@/components/ImageUploadField'
import { useAuthStore } from '@/stores/authStore'
import { PATHS } from '@/router/paths'
import { Avatar } from '@/components/Avatar'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { useSearchPeople } from '@/features/search/hooks/useSearchPeople'
import type { UserSearchResult } from '@/features/search/types'
import type { UserRole } from '@uniconnect/shared'
import type { AllowedRole, Group, GroupType } from '../types'

const TYPES: { value: Exclude<GroupType, 'academic'>; label: string }[] = [
  { value: 'department', label: 'Department' },
  { value: 'club', label: 'Club' },
  { value: 'batch', label: 'Batch' },
  { value: 'research', label: 'Research' },
  { value: 'interest', label: 'Interest' },
  { value: 'other', label: 'Other' },
]

type Kind = 'academic' | 'other'
type Step = 'members' | 'details'

interface CreateGroupResponse {
  data: Group
}

interface ApiError {
  response?: { data?: { error?: string } }
}

export function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const studentLock = user?.role === 'student'
  const canCreateAcademic = user?.role === 'faculty'

  const [step, setStep] = useState<Step>('members')
  const [kind, setKind] = useState<Kind>('other')

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Map<string, UserSearchResult>>(new Map())

  const peopleQuery = useSearchPeople(search.trim() ? { q: search.trim() } : {}, 20)
  const candidates = useMemo(
    () => peopleQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [peopleQuery.data],
  )

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<Exclude<GroupType, 'academic'>>('club')
  const [isPrivate, setIsPrivate] = useState(false)
  const [allowedRole, setAllowedRole] = useState<AllowedRole | null>(studentLock ? 'student' : null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  function toggle(person: UserSearchResult) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(person.id)) next.delete(person.id)
      else next.set(person.id, person)
      return next
    })
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload =
        kind === 'academic'
          ? {
              name: name.trim(),
              description: description.trim(),
              type: 'academic' as const,
              is_private: true,
              allowed_role: 'student' as const,
              avatar_url: avatarUrl ?? null,
              cover_url: coverUrl ?? null,
            }
          : {
              name: name.trim(),
              description: description.trim(),
              type,
              is_private: isPrivate,
              allowed_role: allowedRole,
              avatar_url: avatarUrl ?? null,
              cover_url: coverUrl ?? null,
            }
      const res = await api.post<CreateGroupResponse>('/groups', payload)
      const group = res.data.data
      if (selected.size > 0) {
        await Promise.allSettled(
          Array.from(selected.keys()).map((userId) =>
            api.post(`/groups/${group.id}/invitations`, { userId, role: 'member' }),
          ),
        )
      }
      return group
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
      toast.success('Group created. Members will show as pending until they accept.')
      onClose()
      navigate(`/groups/${group.id}`)
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error ?? 'Failed to create group')
    },
  })

  const canSubmit = name.trim().length > 0 && description.trim().length > 0 && !createMutation.isPending
  const count = selected.size

  if (step === 'members') {
    return (
      <Modal isOpen onClose={onClose} title="Create group" maxWidth={480} sheet>
        <p style={{ margin: '-6px 0 14px', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          Pick the first members. You can name the group next.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              {canCreateAcademic && (
                <KindChip active={kind === 'academic'} onClick={() => setKind('academic')} icon={GraduationCap} label="Academic" />
              )}
              <KindChip active={kind === 'other'} onClick={() => setKind('other')} icon={Users} label="Other" />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {kind === 'academic'
                ? 'A course or section group. You can import a course outline to fill in topics and dates.'
                : 'A club, project, study or interest group. No course fields.'}
            </p>
            {kind === 'academic' && (
              <button
                type="button"
                onClick={() => toast('Course outline import lands in the next update.')}
                className="press-feedback"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--uc-indigo-l)',
                }}
              >
                <FileUp size={13} strokeWidth={1.75} aria-hidden />
                Import a course outline instead
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 38,
              padding: '0 14px',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              flexShrink: 0,
            }}
          >
            <Search size={13} strokeWidth={1.5} color="var(--text-tertiary)" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people by name or department"
              aria-label="Search people"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 400,
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 260, overflowY: 'auto' }}>
            {peopleQuery.isLoading ? (
              <p style={{ margin: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
                Searching…
              </p>
            ) : candidates.length === 0 ? (
              <p style={{ margin: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
                {search ? 'No matches' : 'Search to find people to add'}
              </p>
            ) : (
              candidates.map((person) => {
                const isSelected = selected.has(person.id)
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggle(person)}
                    aria-pressed={isSelected}
                    className="row-hover-bg"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 8px',
                      background: isSelected ? 'var(--uc-indigo-bg)' : 'transparent',
                      border: 'none',
                      borderBottom: '0.5px solid var(--border-default)',
                      borderRadius: 'var(--r-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Avatar
                      src={person.avatarUrl}
                      initials={getInitials(person.fullName)}
                      color={seedColor(person.id)}
                      size={36}
                    />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {person.fullName}
                        </p>
                        <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                          {person.department ?? person.role}
                        </p>
                      </div>
                      <RoleBadge role={person.role as UserRole} size={14} />
                    </div>
                    <span
                      aria-hidden
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? 'var(--uc-indigo)' : 'transparent',
                        border: `0.5px solid ${isSelected ? 'var(--uc-indigo)' : 'var(--border-hover)'}`,
                        color: 'var(--on-accent)',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check size={11} strokeWidth={2} />}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderTop: '0.5px solid var(--border-default)',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {count === 0 ? 'No one selected' : `${count} ${count === 1 ? 'person' : 'people'} selected`}
          </span>
          <Link
            to={`${PATHS.GROUPS}?section=people`}
            onClick={onClose}
            style={{ fontSize: 12, fontWeight: 500, color: 'var(--uc-indigo-l)', textDecoration: 'none' }}
          >
            Full directory
          </Link>
          <span style={{ flex: 1 }} />
          <PrimaryBtn
            onClick={() => setStep('details')}
            style={
              count === 0
                ? { background: 'var(--surface-raised)', color: 'var(--text-tertiary)' }
                : undefined
            }
          >
            {count === 0 ? 'Create group' : `Create with ${count}`}
          </PrimaryBtn>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen onClose={onClose} title="Name the group" maxWidth={480} sheet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            placeholder="e.g. ML Research Club"
            style={inputStyle}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this group about?"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </Field>

        {kind === 'other' && (
          <>
            <Field label="Type">
              <select value={type} onChange={(e) => setType(e.target.value as Exclude<GroupType, 'academic'>)} style={inputStyle}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Members">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <RadioRow
                  checked={allowedRole === null}
                  onChange={() => setAllowedRole(null)}
                  disabled={studentLock}
                  label="Anyone in your university"
                />
                <RadioRow
                  checked={allowedRole === 'student'}
                  onChange={() => setAllowedRole('student')}
                  disabled={false}
                  label="Students only"
                />
                {!studentLock && (
                  <>
                    <RadioRow
                      checked={allowedRole === 'alumni'}
                      onChange={() => setAllowedRole('alumni')}
                      disabled={false}
                      label="Alumni only"
                    />
                    <RadioRow
                      checked={allowedRole === 'faculty'}
                      onChange={() => setAllowedRole('faculty')}
                      disabled={false}
                      label="Faculty only"
                    />
                  </>
                )}
              </div>
              {studentLock && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Students can only create groups for other students.
                </p>
              )}
            </Field>

            <Field label="Privacy">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  style={{ accentColor: 'var(--uc-indigo)' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Private — joinable by invite only
                </span>
              </label>
            </Field>
          </>
        )}

        <ImageUploadField
          value={avatarUrl}
          onChange={setAvatarUrl}
          folder="groups"
          label="Group avatar (optional)"
          aspectRatio="1 / 1"
        />

        <ImageUploadField
          value={coverUrl}
          onChange={setCoverUrl}
          folder="groups"
          label="Cover image (optional)"
          aspectRatio="16 / 5"
        />
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          borderTop: '0.5px solid var(--border-default)',
        }}
      >
        <GhostBtn onClick={() => setStep('members')} disabled={createMutation.isPending}>
          Back
        </GhostBtn>
        <PrimaryBtn onClick={() => createMutation.mutate()} disabled={!canSubmit}>
          {createMutation.isPending ? 'Creating…' : 'Create'}
        </PrimaryBtn>
      </div>
    </Modal>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 13,
  fontWeight: 400,
  color: 'var(--text-primary)',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>{label}</span>
      {children}
    </div>
  )
}

function RadioRow({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: () => void
  disabled: boolean
  label: string
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={{ accentColor: 'var(--uc-indigo)' }}
      />
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
    </label>
  )
}

function KindChip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof GraduationCap
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="press-feedback"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 'var(--r-pill)',
        cursor: 'pointer',
        background: active ? 'var(--uc-indigo-bg)' : 'transparent',
        border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
        color: active ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
      }}
    >
      <Icon size={13} strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  )
}
