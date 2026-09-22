import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { MoreHorizontal, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { GroupPanel } from './GroupPanel'
import { MemberRoleTag } from './MemberRoleTag'
import { useGroupMembers, useRemoveMember, useUpdateMemberRole } from '../hooks/useGroupExtended'
import type { Group, GroupMember } from '../types'

interface MembersPanelProps {
  group: Group
  onClose: () => void
  /** Opens the Invite panel. Hidden when absent (non-admins, system groups). */
  onInvite?: () => void
}

interface ApiError {
  response?: { data?: { error?: string } }
}

function errorMessage(error: unknown, fallback: string) {
  return (error as ApiError)?.response?.data?.error ?? fallback
}

export function MembersPanel({ group, onClose, onInvite }: MembersPanelProps) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const { data, isLoading } = useGroupMembers(group.id, { search: debounced || undefined }, 50)
  const members = data?.items ?? []
  const isAdmin = group.userRole === 'owner' || group.userRole === 'admin'
  const currentUserId = useAuthStore((s) => s.user?.id)

  const footer = (
    <>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
        {group.memberCount.toLocaleString()} {group.memberCount === 1 ? 'member' : 'members'}
      </span>
      {onInvite && (
        <PrimaryBtn onClick={onInvite} style={{ padding: '6px 14px', fontSize: 12 }}>
          Invite
        </PrimaryBtn>
      )}
      <GhostBtn onClick={onClose} style={{ padding: '6px 14px', fontSize: 12 }}>
        Close
      </GhostBtn>
    </>
  )

  return (
    <GroupPanel icon={Users} title="Members" subtitle={group.name} onClose={onClose} footer={footer}>
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
          placeholder="Search members"
          aria-label="Search members"
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

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : members.length === 0 ? (
        <p style={{ margin: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
          {debounced ? 'No matching members' : 'No members yet'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              group={group}
              canManage={isAdmin && member.role !== 'owner' && member.id !== currentUserId}
              onClosePanel={onClose}
            />
          ))}
        </div>
      )}
    </GroupPanel>
  )
}

function MemberRow({
  member,
  group,
  canManage,
  onClosePanel,
}: {
  member: GroupMember
  group: Group
  canManage: boolean
  onClosePanel: () => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const updateRole = useUpdateMemberRole(group.id)
  const remove = useRemoveMember(group.id)

  const message = useMutation({
    mutationFn: () =>
      api.post<{ data: { id: string } }>('/conversations', { participantId: member.id }).then((r) => r.data.data),
    onSuccess: (conv) => {
      onClosePanel()
      navigate(`${PATHS.MESSAGES}/${conv.id}`)
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'Could not open a conversation')),
  })

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open])

  const close = () => setOpen(false)

  function setRole(role: 'member' | 'moderator' | 'admin') {
    close()
    updateRole.mutate(
      { userId: member.id, role },
      {
        onSuccess: () =>
          toast.success(
            role === 'member' ? 'Role removed' : role === 'admin' ? 'Made admin' : 'Made moderator',
          ),
        onError: (error) => toast.error(errorMessage(error, 'Could not update role')),
      },
    )
  }

  function removeMember() {
    close()
    remove.mutate(member.id, {
      onSuccess: () => toast.success(`Removed ${member.fullName}`),
      onError: (error) => toast.error(errorMessage(error, 'Could not remove member')),
    })
  }

  const items: { label: string; onClick: () => void; danger?: boolean; divider?: boolean }[] = [
    { label: 'View profile', onClick: () => { close(); onClosePanel(); navigate(PATHS.PROFILE.replace(':id', member.id)) } },
    { label: 'Message', onClick: () => { close(); message.mutate() } },
  ]
  if (member.role !== 'moderator') items.push({ label: 'Make moderator', onClick: () => setRole('moderator') })
  if (group.userRole === 'owner' && member.role !== 'admin') {
    items.push({ label: 'Make admin', onClick: () => setRole('admin') })
  }
  if (member.role !== 'member') items.push({ label: 'Remove role', onClick: () => setRole('member') })
  items.push({ label: 'Remove from group', onClick: removeMember, danger: true, divider: true })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 8px',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <Avatar src={member.avatarUrl} initials={getInitials(member.fullName)} color={seedColor(member.id)} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {member.fullName}
        </p>
        {(member.headline ?? member.department) && (
          <p
            style={{
              margin: '1px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {member.headline ?? member.department}
          </p>
        )}
      </div>
      <MemberRoleTag role={member.role} hideOwner={group.isSystem} />

      {canManage && (
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={`More actions for ${member.fullName}`}
            aria-haspopup="menu"
            aria-expanded={open}
            className="press-feedback row-hover-bg"
            style={{
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MoreHorizontal size={15} strokeWidth={1.5} />
          </button>

          <AnimatePresence>
            {open && (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={close}
                  style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'transparent', border: 'none', padding: 0, cursor: 'default' }}
                />
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ type: 'tween', duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    zIndex: 1100,
                    background: 'var(--surface-raised)',
                    border: '0.5px solid var(--border-hover)',
                    borderRadius: 'var(--r-md)',
                    padding: 4,
                    minWidth: 180,
                    transformOrigin: 'top right',
                  }}
                >
                  {items.map((item) => (
                    <div key={item.label}>
                      {item.divider && (
                        <div style={{ height: 0.5, background: 'var(--border-default)', margin: '4px 0' }} />
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={item.onClick}
                        className="row-hover-bg"
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '8px 10px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 'var(--r-sm)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 13,
                          fontWeight: 400,
                          color: item.danger ? 'var(--uc-red)' : 'var(--text-primary)',
                        }}
                      >
                        {item.label}
                      </button>
                    </div>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-raised)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 12, width: '40%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        <div style={{ height: 10, width: '28%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
      </div>
    </div>
  )
}
