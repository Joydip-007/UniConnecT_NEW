import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, FileText, Upload } from 'lucide-react'
import { api } from '@/lib/axios'
import { GhostBtn, MintBtn } from '@/components/Button'
import { Modal } from '@/components/Modal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  jobId: string
  jobTitle: string
  company: string
  onSuccess: () => void
  onClose: () => void
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

const ACCEPTED = '.pdf,.doc,.docx'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
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
  transition: 'border-color 150ms',
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
}

// ── ApplyModal ────────────────────────────────────────────────────────────────

export function ApplyModal({ jobId, jobTitle, company, onSuccess, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadError, setUploadError] = useState('')
  const [fileName, setFileName] = useState('')
  const [resumeUrl, setResumeUrl] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_BYTES) {
      setUploadError('File exceeds 5 MB. Please choose a smaller file.')
      return
    }

    setUploadError('')
    setUploadState('uploading')
    setFileName(file.name)

    try {
      // 1. Get presigned URL
      const presignRes = await api.get<{
        data: { uploadUrl: string; publicUrl: string }
      }>('/upload/presign', {
        params: { filename: file.name, contentType: file.type },
      })
      const { uploadUrl, publicUrl } = presignRes.data.data

      // 2. PUT directly to S3 — no auth headers
      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!s3Res.ok) throw new Error('Upload failed')

      setResumeUrl(publicUrl)
      setUploadState('done')
    } catch {
      setUploadState('error')
      setUploadError('Upload failed. Please try again.')
    }
  }

  function resetFile() {
    setUploadState('idle')
    setFileName('')
    setResumeUrl('')
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const applyMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/jobs/${jobId}/apply`, {
          resumeUrl,
          ...(coverLetter.trim() && { coverLetter: coverLetter.trim() }),
        })
        .then((r) => r.data),
    onSuccess: () => {
      setSubmitted(true)
      onSuccess()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    applyMutation.mutate()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={submitted ? 'Application submitted' : `Apply for ${jobTitle}`}
      maxWidth={440}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p
          style={{
            margin: '-16px 0 0',
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-secondary)',
          }}
        >
          {company}
        </p>

        {/* ── Success state ─────────────────────────────────────────────── */}
        {submitted ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0 4px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--uc-mint-bg)',
                border: '0.5px solid var(--uc-mint-bdr)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={26} strokeWidth={1.5} color="var(--uc-mint)" />
            </div>
            <div>
              <p
                style={{
                  margin: '0 0 5px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                }}
              >
                You're all set
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 400,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                }}
              >
                Your application for{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{jobTitle}</span>{' '}
                has been sent. You'll be notified when there's an update.
              </p>
            </div>
            <MintBtn onClick={onClose} style={{ marginTop: 4 }}>
              Done
            </MintBtn>
          </div>
        ) : (
          /* ── Form ──────────────────────────────────────────────────────── */
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {/* Resume upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="apply-modal-resume"
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
              >
                Resume
              </label>

              {/* Hidden file input */}
              <input
                id="apply-modal-resume"
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                aria-label="Upload resume"
              />

              {uploadState === 'idle' || uploadState === 'error' ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '20px 16px',
                    background: 'var(--surface-raised)',
                    border: `0.5px dashed ${uploadState === 'error' ? 'var(--uc-red)' : 'var(--border-hover)'}`,
                    borderRadius: 'var(--r-md)',
                    cursor: 'pointer',
                    transition: 'border-color 150ms, background 150ms',
                    width: '100%',
                  }}
                  className="row-hover-bg"
                >
                  <Upload
                    size={20}
                    strokeWidth={1.5}
                    color={uploadState === 'error' ? 'var(--uc-red)' : 'var(--text-tertiary)'}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 400,
                      color: uploadState === 'error' ? 'var(--uc-red)' : 'var(--text-secondary)',
                    }}
                  >
                    {uploadState === 'error' ? uploadError : 'Click to upload resume'}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    PDF, DOC, DOCX — max 5 MB
                  </span>
                </button>
              ) : uploadState === 'uploading' ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    background: 'var(--surface-raised)',
                    border: '0.5px solid var(--border-default)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <FileText size={18} strokeWidth={1.5} color="var(--text-secondary)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: '0 0 5px',
                        fontSize: 12,
                        fontWeight: 400,
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fileName}
                    </p>
                    {/* Indeterminate progress bar */}
                    <div
                      style={{
                        height: 3,
                        borderRadius: 'var(--r-pill)',
                        background: 'var(--border-default)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: '40%',
                          background: 'var(--uc-indigo)',
                          borderRadius: 'var(--r-pill)',
                          animation: 'slide 1.2s ease-in-out infinite',
                        }}
                      />
                    </div>
                  </div>
                  <span
                    style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}
                  >
                    Uploading…
                  </span>
                </div>
              ) : (
                /* done */
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 14px',
                    background: 'var(--uc-mint-bg)',
                    border: '0.5px solid var(--uc-mint-bdr)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <CheckCircle2 size={18} strokeWidth={1.5} color="var(--uc-mint)" />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      fontWeight: 400,
                      color: 'var(--uc-mint)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fileName}
                  </span>
                  <button
                    type="button"
                    onClick={resetFile}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 400,
                      color: 'var(--text-tertiary)',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Cover letter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="applyModalCoverLetter"
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
              >
                Cover letter{' '}
                <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span>
              </label>
              <textarea
                id="applyModalCoverLetter"
                rows={4}
                placeholder="Tell them why you're a great fit…"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: 1.6,
                  padding: '9px 12px',
                }}
                onFocus={focusBorder}
                onBlur={blurBorder}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhostBtn type="button" onClick={onClose}>
                Cancel
              </GhostBtn>
              <MintBtn
                type="submit"
                disabled={
                  uploadState !== 'done' || applyMutation.isPending
                }
              >
                {applyMutation.isPending ? 'Submitting…' : 'Submit application'}
              </MintBtn>
            </div>
          </form>
        )}
      </div>

      {/* Keyframe for upload progress bar */}
      <style>{`
        @keyframes slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(150%); }
        }
      `}</style>
    </Modal>
  )
}
