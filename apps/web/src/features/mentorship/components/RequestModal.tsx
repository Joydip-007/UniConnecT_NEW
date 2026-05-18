import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { api } from '@/lib/axios'
import { avatarColor, getInitials } from '@/utils/avatar'
import type { AlumniMentor } from '../types'

const MAX_CHARS = 500

interface RequestModalProps {
  alumni: AlumniMentor
  onClose: () => void
  onSuccess: (alumniName: string) => void
}

export function RequestModal({ alumni, onClose, onSuccess }: RequestModalProps) {
  const [message, setMessage] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api
        .post('/mentorship/requests', { alumniId: alumni.id, message })
        .then((r) => r.data.data),
    onSuccess: () => onSuccess(alumni.fullName),
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--overlay-bg-strong)',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 24,
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar initials={getInitials(alumni.fullName)} color={avatarColor(alumni.id)} size={40} />
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
              {alumni.fullName}
            </p>
            {alumni.headline && (
              <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                {alumni.headline}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Your message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Introduce yourself and describe what kind of guidance you're looking for…"
            rows={5}
            style={{
              width: '100%',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 400,
              padding: '10px 12px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              boxSizing: 'border-box',
              transition: 'border-color 150ms',
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              textAlign: 'right',
            }}
          >
            {message.length}/{MAX_CHARS}
          </span>
        </div>

        {mutation.isError && (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--uc-red)' }}>
            Failed to send request. Please try again.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </GhostBtn>
          <PrimaryBtn
            onClick={() => mutation.mutate()}
            disabled={message.trim().length === 0 || mutation.isPending}
          >
            {mutation.isPending ? 'Sending…' : 'Send request'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  )
}
