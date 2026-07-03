import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { Modal } from '@/components/Modal'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { ImageUploadField } from '@/components/ImageUploadField'
import { useAuthStore } from '@/stores/authStore'
import type { AllowedRole, Group, GroupType } from '../types'

const TYPES: { value: GroupType; label: string }[] = [
  { value: 'department', label: 'Department' },
  { value: 'club', label: 'Club' },
  { value: 'batch', label: 'Batch' },
  { value: 'research', label: 'Research' },
  { value: 'interest', label: 'Interest' },
  { value: 'other', label: 'Other' },
]

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

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<GroupType>('club')
  const [isPrivate, setIsPrivate] = useState(false)
  const [allowedRole, setAllowedRole] = useState<AllowedRole | null>(studentLock ? 'student' : null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        type,
        is_private: isPrivate,
        allowed_role: allowedRole,
        avatar_url: avatarUrl ?? null,
        cover_url: coverUrl ?? null,
      }
      const res = await api.post<CreateGroupResponse>('/groups', payload)
      return res.data.data
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
      toast.success('Group created')
      onClose()
      navigate(`/groups/${group.id}`)
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error ?? 'Failed to create group')
    },
  })

  const canSubmit = name.trim().length > 0 && description.trim().length > 0 && !createMutation.isPending

  return (
    <Modal isOpen onClose={onClose} title="Create a group" maxWidth={480}>
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

          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as GroupType)} style={inputStyle}>
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
              <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
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
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            borderTop: '0.5px solid var(--border-default)',
          }}
        >
          <GhostBtn onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </GhostBtn>
          <PrimaryBtn onClick={() => createMutation.mutate()} disabled={!canSubmit}>
            {createMutation.isPending ? 'Creating…' : 'Create group'}
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
