import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFeatured } from '@/lib/api/users'
import { Modal } from '@/components/Modal'
import { GhostBtn, PrimaryBtn } from '@/components/Button'

const inputBase: React.CSSProperties = {
  padding: '9px 12px',
  fontSize: 13,
  fontWeight: 400,
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color 150ms',
}

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

function FieldRow({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>
          {label}
          {optional && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>(optional)</span>}
        </span>
        {children}
      </label>
    </div>
  )
}

interface Props {
  userId: string
  onClose: () => void
}

export function FeaturedModal({ userId, onClose }: Props) {
  const qc = useQueryClient()

  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkDescription, setLinkDescription] = useState('')

  const saveMutation = useMutation({
    mutationFn: () =>
      createFeatured({
        type: 'link',
        postId: null,
        linkUrl: linkUrl.trim(),
        linkTitle: linkTitle.trim(),
        linkDescription: linkDescription.trim() || null,
        displayOrder: 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', 'featured', userId] })
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!linkTitle.trim() || !linkUrl.trim()) return
    saveMutation.mutate()
  }

  return (
    <Modal isOpen onClose={onClose} title="Add featured link" maxWidth={480}>
        <form
          id="featured-form"
          onSubmit={handleSubmit}
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 20px 4px' }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Feature a link to a project, article, portfolio, or anything you'd like to highlight on your profile.
          </p>

          <FieldRow label="Title">
            <input type="text" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="e.g. My portfolio website" required maxLength={120}
              style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <FieldRow label="URL">
            <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com" required
              style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <FieldRow label="Description" optional>
            <textarea value={linkDescription} onChange={(e) => setLinkDescription(e.target.value)}
              placeholder="Tell people what this link is about…" rows={3} maxLength={300}
              style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6, minHeight: 72 }}
              onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>

          <div style={{ height: 4, flexShrink: 0 }} />
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '0.5px solid var(--border-default)', flexShrink: 0 }}>
          {saveMutation.isError && (
            <span style={{ flex: 1, fontSize: 12, color: 'var(--uc-red)' }}>Failed to save — try again</span>
          )}
          <GhostBtn type="button" onClick={onClose} disabled={saveMutation.isPending}>Cancel</GhostBtn>
          <PrimaryBtn type="submit" form="featured-form" disabled={!linkTitle.trim() || !linkUrl.trim() || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Add featured'}
          </PrimaryBtn>
        </div>
    </Modal>
  )
}
