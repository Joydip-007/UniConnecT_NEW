import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Bookmark, Briefcase, CheckCircle2, Clock, ExternalLink, MapPin, Users } from 'lucide-react'
import { api } from '@/lib/axios'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { GhostBtn, MintBtn } from '@/components/Button'
import { ApplyModal } from '@/features/jobs/components/ApplyModal'
import { ApplicationsList } from '@/features/jobs/components/ApplicationsList'
import type { Job } from '@/features/jobs/components/JobCard'
import { AttachmentList } from '@/features/content-sync'

const TYPE_LABELS: Record<Job['type'], string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Internship',
  remote: 'Remote',
  contract: 'Contract',
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [applyOpen, setApplyOpen] = useState(false)

  const queryKey = ['jobs', 'detail', id]
  const { data: job, isPending, isError } = useQuery({
    queryKey,
    enabled: Boolean(id),
    queryFn: () => api.get<{ data: Job }>(`/jobs/${id}`).then((r) => r.data.data),
  })

  const saveMutation = useMutation({
    mutationFn: (wasSaved: boolean) =>
      wasSaved ? api.delete(`/jobs/${id}/save`) : api.post(`/jobs/${id}/save`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  if (!id) return null

  if (isPending) {
    return (
      <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 400 }}>
        Loading job…
      </div>
    )
  }

  if (isError || !job) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Job not found"
        description="This opportunity may have expired or been removed."
        action={{ label: 'Back to jobs', onClick: () => navigate('/jobs') }}
      />
    )
  }

  const canViewApplications = user?.role === 'admin' || user?.id === job.postedBy.id
  const hasApplied = Boolean(job.myApplication)

  function handleSave() {
    if (!job) return
    saveMutation.mutate(job.isSaved)
  }

  function handleApply() {
    if (!job || hasApplied) return
    if (job.applicationUrl) {
      if (!job.applicationUrl.startsWith('https://')) return
      window.open(job.applicationUrl, '_blank', 'noopener,noreferrer')
      return
    }
    setApplyOpen(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button
        type="button"
        onClick={() => navigate('/jobs')}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 13,
          fontWeight: 400,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <ArrowLeft size={15} strokeWidth={1.5} />
        Back to jobs
      </button>

      <article
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--r-md)',
              background: 'var(--uc-indigo-bg)',
              border: '0.5px solid var(--uc-indigo-bdr)',
              color: 'var(--uc-indigo-xl)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {job.company.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge variant="alumni">{TYPE_LABELS[job.type]}</Badge>
              {hasApplied && (
                <Badge variant="live">
                  <CheckCircle2 size={10} strokeWidth={2} style={{ marginRight: 3 }} />
                  Applied
                </Badge>
              )}
            </div>
            <h1 style={{ margin: '9px 0 4px', fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.25 }}>
              {job.title}
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 400 }}>
              {job.company}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Meta icon={<MapPin size={14} strokeWidth={1.5} />} label={job.location} />
          {job.deadline && (
            <Meta icon={<Clock size={14} strokeWidth={1.5} />} label={`Closes ${format(parseISO(job.deadline), 'MMM d, yyyy')}`} />
          )}
          <Meta icon={<Users size={14} strokeWidth={1.5} />} label={`${job.applicationCount} applied`} />
          {job.salaryRange && <Meta icon={<Briefcase size={14} strokeWidth={1.5} />} label={job.salaryRange} />}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <MintBtn disabled={hasApplied} onClick={handleApply}>
            {job.applicationUrl ? <ExternalLink size={14} strokeWidth={1.5} /> : <CheckCircle2 size={14} strokeWidth={1.5} />}
            {hasApplied ? 'Applied' : 'Apply'}
          </MintBtn>
          <GhostBtn onClick={handleSave} disabled={saveMutation.isPending}>
            <Bookmark size={14} strokeWidth={1.5} fill={job.isSaved ? 'currentColor' : 'none'} />
            {job.isSaved ? 'Saved' : 'Save'}
          </GhostBtn>
        </div>

        <section>
          <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
            About the role
          </h2>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 400, lineHeight: 1.7 }}>
            {job.description}
          </p>
          <AttachmentList attachments={job.attachments} />
        </section>

        {job.requirements.length > 0 && (
          <section>
            <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
              Requirements
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {job.requirements.map((requirement) => (
                <Badge key={requirement} variant="neutral">
                  {requirement}
                </Badge>
              ))}
            </div>
          </section>
        )}

        <section
          style={{
            borderTop: '0.5px solid var(--border-default)',
            paddingTop: 14,
            color: 'var(--text-tertiary)',
            fontSize: 12,
            fontWeight: 400,
          }}
        >
          Posted by {job.postedBy.fullName}
          {job.postedBy.profile.headline ? `, ${job.postedBy.profile.headline}` : ''}
        </section>
      </article>

      {canViewApplications && <ApplicationsList jobId={job.id} />}

      {applyOpen && (
        <ApplyModal
          jobId={job.id}
          jobTitle={job.title}
          company={job.company}
          onSuccess={() => {
            setApplyOpen(false)
            queryClient.invalidateQueries({ queryKey })
          }}
          onClose={() => setApplyOpen(false)}
        />
      )}
    </div>
  )
}

function Meta({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--text-secondary)',
        fontSize: 13,
        fontWeight: 400,
      }}
    >
      {icon}
      {label}
    </span>
  )
}
