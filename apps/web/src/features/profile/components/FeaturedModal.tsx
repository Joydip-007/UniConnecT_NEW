import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { createFeatured } from '@/lib/api/users'
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
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
        {label}
        {optional && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>(optional)</span>}
      </label>
      {children}
    </div>
  )
}

interface Props {
  userId: string
  onClose: () => void
}

export function FeaturedModal({ userId, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkDescription, setLinkDescription] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'var(--overlay-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 210, padding: '24px 16px',
      }}
      role="dialog"
      aria-modal
      aria-labelledby="featured-modal-title"
    >
      <div
        style={{
          width: '100%', maxWidth: 480, maxHeight: 'calc(100vh - 48px)',
          background: 'var(--surface-card)', border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '0.5px solid var(--border-default)', flexShrink: 0 }}>
          <h2 id="featured-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
            Add featured link
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', lineHeight: 0 }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

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
      </div>
    </div>
  )
}
