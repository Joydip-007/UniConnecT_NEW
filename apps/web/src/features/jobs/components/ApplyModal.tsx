import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, CheckCircle2, FileText, Upload, X } from 'lucide-react'
import { isAxiosError } from 'axios'
import { api } from '@/lib/axios'
import { Modal } from '@/components/Modal'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { seedLogoStyle } from '../jobMeta'
import { useApplyToJob, useJobEligibility } from '../hooks/useJobs'
import type { Job } from './JobCard'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em' }

function errorMessage(err: unknown): string {
  if (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) return err.response.data.error
  return 'Could not submit your application. Try again.'
}

/**
 * Apply flow: the requirements check reads the applicant's profile (the same
 * `evaluateJobEligibility` the API enforces), and the resume comes from the profile too.
 * Uploading a different file here replaces the profile resume, so the next application
 * starts from it.
 */
export function ApplyModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const profile = useAuthStore((s) => s.user?.profile)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const showToast = useToastStore((s) => s.show)
  const { isStudent, verdict } = useJobEligibility(job)
  const apply = useApplyToJob(job.id)
  const upload = usePresignedUpload('resumes')
  const fileRef = useRef<HTMLInputElement>(null)

  const [note, setNote] = useState('')
  const [fileError, setFileError] = useState('')
  const [justUploaded, setJustUploaded] = useState(false)

  const resumeUrl = profile?.resumeUrl ?? null
  const resumeName = profile?.resumeName ?? (resumeUrl ? 'Resume' : null)
  const resumeMeta = justUploaded
    ? 'Uploaded now · saved to your profile'
    : profile?.resumeUpdatedAt
      ? `From profile · updated ${format(parseISO(profile.resumeUpdatedAt), 'MMM d')}`
      : 'From profile'

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) {
      setFileError('That file is over 5 MB. Choose a smaller one.')
      return
    }
    setFileError('')
    try {
      const url = await upload.upload(file)
      await api.patch('/users/me', { resumeUrl: url, resumeName: file.name })
      updateProfile({ resumeUrl: url, resumeName: file.name, resumeUpdatedAt: new Date().toISOString() })
      setJustUploaded(true)
    } catch {
      setFileError('Upload failed. Try again.')
    }
  }

  function submit() {
    if (!resumeUrl) return
    apply.mutate(
      { resumeUrl, ...(note.trim() && { coverLetter: note.trim() }) },
      {
        onSuccess: () => {
          showToast({ message: `Applied to ${job.title}` })
          onClose()
        },
      },
    )
  }

  const logo = seedLogoStyle(job.company)
  const dlLabel = job.deadline ? `Closes ${format(parseISO(job.deadline), 'MMM d')}` : 'No deadline'
  // Non-students are not bound by the audience rules; they still see the skills fit.
  const checks = isStudent ? verdict.checks : verdict.checks.filter((c) => c.key === 'skills')
  const showChecks = isStudent || job.requirements.length > 0

  const ghost: React.CSSProperties = {
    minHeight: isMobile ? 44 : 40,
    padding: '0 16px',
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 'var(--r-pill)',
    border: '0.5px solid var(--border-hover)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'inherit',
    cursor: 'pointer',
  }

  return (
    <Modal isOpen onClose={onClose} title={`Apply for ${job.title}`} frame="panel" sheet>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 10 : 12, padding: isMobile ? '8px 16px 14px' : '18px 20px', borderBottom: '0.5px solid var(--border-default)' }}>
        <div
          style={{
            width: isMobile ? 36 : 38,
            height: isMobile ? 36 : 38,
            borderRadius: 'var(--r-md)',
            fontSize: isMobile ? 15 : 16,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: logo.bg,
            border: `0.5px solid ${logo.border}`,
            color: logo.color,
          }}
        >
          {job.company.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{job.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {job.company} · {dlLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 'var(--r-pill)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <X size={isMobile ? 18 : 16} />
        </button>
      </div>

      {/* Body */}
      <div className="rail-scroll" style={{ overflowY: 'auto', padding: isMobile ? '14px 16px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 16 }}>
        {showChecks && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={eyebrow}>Requirements check</span>
            {checks.map((c) => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ lineHeight: 0, color: c.ok ? 'var(--uc-mint)' : 'var(--uc-amber-l)' }}>
                  {c.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                </span>
                <span style={{ flex: 1, color: 'var(--text-primary)' }}>{c.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.detail}</span>
              </div>
            ))}
          </div>
        )}

        {verdict.missingSkills.length > 0 && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--uc-amber-bg)', border: '0.5px solid var(--uc-amber-bdr)', fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            <AlertTriangle size={14} color="var(--uc-amber-l)" style={{ marginTop: 2, flexShrink: 0 }} />
            <span>You can still apply. Mention how you would cover {verdict.missingSkills.join(', ')} in your note.</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!isMobile && <span style={eyebrow}>Resume</span>}
          <input ref={fileRef} type="file" accept={ACCEPT} onChange={onFile} aria-label="Upload resume" style={{ display: 'none' }} />
          {resumeUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)' }}>
              <FileText size={16} color="var(--uc-indigo-l)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 0 : 10 }}>
                <a href={resumeUrl} target="_blank" rel="noopener noreferrer" style={{ flex: isMobile ? undefined : 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {resumeName}
                </a>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{resumeMeta}</span>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={upload.uploading}
                style={{ flexShrink: 0, fontSize: 12, fontWeight: 500, padding: '5px 12px', minHeight: isMobile ? 36 : undefined, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer' }}
              >
                {upload.uploading ? 'Uploading…' : 'Replace'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upload.uploading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, minHeight: 44, borderRadius: 'var(--r-md)', border: '0.5px dashed var(--border-hover)', background: 'transparent', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <Upload size={14} />
              {upload.uploading ? 'Uploading…' : 'Upload your CV · PDF or DOCX up to 5 MB · saved to your profile'}
            </button>
          )}
          {fileError && <span role="alert" style={{ fontSize: 12, color: 'var(--uc-red)' }}>{fileError}</span>}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!isMobile && <span style={eyebrow}>Note to the poster (optional)</span>}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            aria-label="Note to the poster"
            placeholder={isMobile ? 'Note to the poster (optional)' : 'Why this role, and anything they should know'}
            style={{ resize: 'none', padding: '10px 12px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-md)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </label>

        {apply.isError && (
          <span role="alert" style={{ fontSize: 12, color: 'var(--uc-red)' }}>
            {errorMessage(apply.error)}
          </span>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: isMobile ? '12px 16px 16px' : '14px 20px', borderTop: '0.5px solid var(--border-default)' }}>
        <button type="button" onClick={onClose} style={{ ...ghost, flex: isMobile ? 1 : undefined }}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!resumeUrl || apply.isPending || upload.uploading}
          title={!resumeUrl ? 'Add a resume first' : undefined}
          style={{
            ...ghost,
            flex: isMobile ? 2 : undefined,
            padding: '0 18px',
            border: 'none',
            background: 'var(--uc-mint)',
            color: 'var(--on-accent)',
            opacity: !resumeUrl || apply.isPending ? 0.45 : 1,
            cursor: !resumeUrl ? 'not-allowed' : 'pointer',
          }}
        >
          {apply.isPending ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </Modal>
  )
}
