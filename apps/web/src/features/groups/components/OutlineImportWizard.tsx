import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ClipboardList,
  FileCheck,
  FileText,
  FileUp,
  GraduationCap,
  Lock,
  Pencil,
  Sparkles,
  TriangleAlert,
  UserPlus,
  X,
} from 'lucide-react'
import { Modal } from '@/components/Modal'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { Toggle } from '@/features/settings/components/Toggle'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import {
  useBulkInvite,
  useCreateGroupFromOutline,
  useInviteMatch,
  useOutlineDraft,
} from '../hooks/useOutlineImport'
import type {
  BulkInviteResult,
  CourseOutlineDraft,
  CourseOutlineDraftAssignment,
  Group,
  OutlineAssignmentKind,
} from '../types'

type Step = 'upload' | 'review' | 'created' | 'invite'

const STEP_ORDER: Step[] = ['upload', 'review', 'created', 'invite']
const STEP_LABELS: Record<Step, string> = {
  upload: 'Upload',
  review: 'Review',
  created: 'Created',
  invite: 'Invite',
}

const WEIGHT_COLORS = ['var(--uc-indigo)', 'var(--uc-cyan)', 'var(--uc-mint)', 'var(--uc-amber)', 'var(--uc-orange-l)']

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  upload: {
    title: 'Import a course outline',
    subtitle: 'Upload the outline and we fill in topics, dates and weights for you to check.',
  },
  review: {
    title: 'Review the draft',
    subtitle: 'Dashed fields need your input. Nothing is created until you confirm.',
  },
  created: {
    title: 'Group created',
    subtitle: 'The course group is live — invite your students next.',
  },
  invite: {
    title: 'Invite students by section',
    subtitle: 'Match by department and batch, or add emails directly.',
  },
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function parseEmailList(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of text.split(/[\n,]/)) {
    const email = raw.trim().toLowerCase()
    if (email && isValidEmail(email)) seen.add(email)
  }
  return Array.from(seen)
}

export function OutlineImportWizard({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('upload')

  // ── Upload ──────────────────────────────────────────────────
  const [outlineFile, setOutlineFile] = useState<File | null>(null)
  const [rosterFile, setRosterFile] = useState<File | null>(null)
  const outlineUpload = usePresignedUpload('course-outline')
  const rosterUpload = usePresignedUpload('course-outline')
  const draftMutation = useOutlineDraft()

  // ── Review ──────────────────────────────────────────────────
  const [draft, setDraft] = useState<CourseOutlineDraft | null>(null)
  const [rosterEmails, setRosterEmails] = useState<string[]>([])
  const [section, setSection] = useState('')
  const createMutation = useCreateGroupFromOutline()

  // ── Created / Invite ────────────────────────────────────────
  const [createdGroup, setCreatedGroup] = useState<Group | null>(null)
  const [department, setDepartment] = useState('')
  const [batchYear, setBatchYear] = useState<number | null>(null)
  const [alsoInviteEmail, setAlsoInviteEmail] = useState(false)
  const [emailsText, setEmailsText] = useState('')
  const [inviteResult, setInviteResult] = useState<BulkInviteResult | null>(null)
  const inviteMatch = useInviteMatch(department, batchYear)
  const bulkInvite = useBulkInvite(createdGroup?.id ?? '')

  const busyUploading = outlineUpload.uploading || rosterUpload.uploading || draftMutation.isPending

  async function handleGenerateDraft() {
    if (!outlineFile) return
    try {
      const fileUrl = await outlineUpload.upload(outlineFile)
      const rosterUrl = rosterFile ? await rosterUpload.upload(rosterFile) : undefined
      const result = await draftMutation.mutateAsync({ fileUrl, rosterUrl })
      setDraft(result.draft)
      setRosterEmails(result.rosterEmails)
      setSection(result.draft.section ?? '')
      setStep('review')
    } catch {
      toast.error('Could not read that outline. Try a different file.')
    }
  }

  function updateDraft(patch: Partial<CourseOutlineDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const weightSum = draft?.assessments.reduce((sum, a) => sum + (a.weightPercent || 0), 0) ?? 0
  const weightValid = Math.abs(weightSum - 100) < 0.01
  const courseNameValid = Boolean(draft?.courseTitle.trim())
  const canConfirm = Boolean(draft) && weightValid && courseNameValid && !createMutation.isPending

  async function handleConfirm() {
    if (!draft || !canConfirm) return
    try {
      const group = await createMutation.mutateAsync({
        name: draft.courseTitle.trim(),
        section: section.trim() || undefined,
        draft,
        is_private: true,
      })
      setCreatedGroup(group)
      setStep('created')
    } catch {
      toast.error('Could not create the group from this draft.')
    }
  }

  function goToGroup() {
    if (!createdGroup) return
    onClose()
    navigate(`/groups/${createdGroup.id}`)
  }

  async function handleSendInvites() {
    if (!createdGroup) return
    try {
      const result = await bulkInvite.mutateAsync({
        department: department.trim() || undefined,
        batch_year: batchYear ?? undefined,
        emails: alsoInviteEmail ? parseEmailList(emailsText) : undefined,
      })
      setInviteResult(result)
    } catch {
      toast.error('Could not send invites.')
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={STEP_COPY[step].title} frame="panel">
      <WizardHeader step={step} onClose={onClose} />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {step === 'upload' && (
          <UploadStep
            outlineFile={outlineFile}
            setOutlineFile={setOutlineFile}
            rosterFile={rosterFile}
            setRosterFile={setRosterFile}
          />
        )}
        {step === 'review' && draft && (
          <ReviewStep
            draft={draft}
            updateDraft={updateDraft}
            section={section}
            setSection={setSection}
            weightSum={weightSum}
            weightValid={weightValid}
          />
        )}
        {step === 'created' && createdGroup && <CreatedStep group={createdGroup} section={section} />}
        {step === 'invite' && createdGroup && (
          <InviteStep
            groupCourseTitle={draft?.courseTitle ?? createdGroup.name}
            department={department}
            setDepartment={setDepartment}
            batchYear={batchYear}
            setBatchYear={setBatchYear}
            matchCount={inviteMatch.data?.count}
            alsoInviteEmail={alsoInviteEmail}
            setAlsoInviteEmail={(next) => {
              setAlsoInviteEmail(next)
              if (next && !emailsText && rosterEmails.length > 0) {
                setEmailsText(rosterEmails.join('\n'))
              }
            }}
            emailsText={emailsText}
            setEmailsText={setEmailsText}
            rosterEmails={rosterEmails}
            inviteResult={inviteResult}
          />
        )}
      </div>

      <div
        style={{
          padding: '12px 18px',
          borderTop: '0.5px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {step === 'upload' && (
          <>
            <GhostBtn onClick={onClose} disabled={busyUploading}>
              Discard
            </GhostBtn>
            <PrimaryBtn onClick={handleGenerateDraft} disabled={!outlineFile || busyUploading}>
              {busyUploading ? 'Reading outline…' : 'Upload and generate draft'}
            </PrimaryBtn>
          </>
        )}
        {step === 'review' && (
          <>
            <GhostBtn onClick={onClose} disabled={createMutation.isPending}>
              Discard
            </GhostBtn>
            <PrimaryBtn onClick={handleConfirm} disabled={!canConfirm}>
              {createMutation.isPending ? 'Creating…' : 'Confirm and create group'}
            </PrimaryBtn>
          </>
        )}
        {step === 'created' && (
          <PrimaryBtn onClick={() => setStep('invite')}>
            <UserPlus size={14} strokeWidth={1.75} aria-hidden />
            Invite students by section
          </PrimaryBtn>
        )}
        {step === 'invite' && (
          <>
            <GhostBtn onClick={goToGroup}>Discard</GhostBtn>
            <PrimaryBtn onClick={handleSendInvites} disabled={bulkInvite.isPending || Boolean(inviteResult)}>
              {inviteResult ? 'Invites sent' : bulkInvite.isPending ? 'Sending…' : 'Send invites'}
            </PrimaryBtn>
          </>
        )}
      </div>
    </Modal>
  )
}

function WizardHeader({ step, onClose }: { step: Step; onClose: () => void }) {
  const idx = STEP_ORDER.indexOf(step)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 18px',
        borderBottom: '0.5px solid var(--border-default)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {STEP_ORDER.map((s, i) => {
            const state = i === idx ? 'active' : i < idx ? 'past' : 'future'
            return (
              <span
                key={s}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: 11,
                  fontWeight: 500,
                  border: '0.5px solid ' + (state === 'active' ? 'var(--uc-indigo-bdr)' : 'transparent'),
                  background: state === 'active' ? 'var(--uc-indigo-bg)' : 'transparent',
                  color:
                    state === 'active'
                      ? 'var(--uc-indigo-xl)'
                      : state === 'past'
                        ? 'var(--text-secondary)'
                        : 'var(--text-tertiary)',
                }}
              >
                {STEP_LABELS[s]}
              </span>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press-feedback"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          {STEP_COPY[step].title}
        </h2>
        <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
          {STEP_COPY[step].subtitle}
        </p>
      </div>
    </div>
  )
}

// ── Upload step ────────────────────────────────────────────────

function DropZone({
  file,
  onFile,
  accept,
  required,
  title,
  hint,
}: {
  file: File | null
  onFile: (file: File | null) => void
  accept: string
  required: boolean
  title: string
  hint: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 'var(--r-pill)',
            color: required ? 'var(--uc-orange-l)' : 'var(--text-tertiary)',
            background: required ? 'var(--uc-orange-bg)' : 'var(--surface-raised)',
          }}
        >
          {required ? 'Required' : 'Optional'}
        </span>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const dropped = e.dataTransfer.files?.[0]
          if (dropped) onFile(dropped)
        }}
        style={{
          padding: '18px 14px',
          borderRadius: 'var(--r-md)',
          border: `0.5px dashed ${dragOver ? 'var(--uc-indigo)' : 'var(--border-hover)'}`,
          background: dragOver ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          textAlign: 'center',
        }}
      >
        <FileUp size={21} strokeWidth={1.5} color="var(--uc-indigo-l)" aria-hidden />
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>{hint.split(' — ')[0]}</span>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>{hint.split(' — ')[1] ?? hint}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {file && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 10px',
            borderRadius: 'var(--r-sm)',
            border: '0.5px solid var(--border-default)',
            background: 'var(--surface-card)',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name} · {(file.size / 1024).toFixed(0)} kb
          </span>
          <button
            type="button"
            onClick={() => onFile(null)}
            aria-label={`Remove ${file.name}`}
            className="press-feedback"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, lineHeight: 0 }}
          >
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}

function UploadStep({
  outlineFile,
  setOutlineFile,
  rosterFile,
  setRosterFile,
}: {
  outlineFile: File | null
  setOutlineFile: (f: File | null) => void
  rosterFile: File | null
  setRosterFile: (f: File | null) => void
}) {
  return (
    <>
      <DropZone
        file={outlineFile}
        onFile={setOutlineFile}
        accept=".pdf,.doc,.docx"
        required
        title="Course outline"
        hint="Drop the outline here, or browse — pdf or docx, up to 10 mb"
      />
      <DropZone
        file={rosterFile}
        onFile={setRosterFile}
        accept=".pdf,.doc,.docx,.csv"
        required={false}
        title="Section roster"
        hint="Drop a roster, or browse — pdf, docx or csv"
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '12px 14px',
          borderRadius: 'var(--r-md)',
          border: '0.5px solid var(--border-default)',
          background: 'var(--surface-page)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>What happens next</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          <FileText size={13} strokeWidth={1.5} color="var(--uc-indigo-l)" aria-hidden />
          <span>Outline read</span>
          <span style={{ color: 'var(--text-tertiary)' }}>›</span>
          <Sparkles size={13} strokeWidth={1.5} color="var(--uc-indigo-l)" aria-hidden />
          <span>Draft built</span>
          <span style={{ color: 'var(--text-tertiary)' }}>›</span>
          <Pencil size={13} strokeWidth={1.5} color="var(--uc-indigo-l)" aria-hidden />
          <span>Your review</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
          Nothing is created until you confirm the draft.
        </p>
      </div>
    </>
  )
}

// ── Review step ────────────────────────────────────────────────

function ReviewStep({
  draft,
  updateDraft,
  section,
  setSection,
  weightSum,
  weightValid,
}: {
  draft: CourseOutlineDraft
  updateDraft: (patch: Partial<CourseOutlineDraft>) => void
  section: string
  setSection: (v: string) => void
  weightSum: number
  weightValid: boolean
}) {
  function updateTopic(index: number, title: string) {
    updateDraft({
      topics: draft.topics.map((t, i) => (i === index ? { ...t, title } : t)),
    })
  }
  function updateTopicDate(index: number, description: string) {
    updateDraft({
      topics: draft.topics.map((t, i) => (i === index ? { ...t, description } : t)),
    })
  }

  function updateAssessment(index: number, patch: Partial<CourseOutlineDraft['assessments'][number]>) {
    updateDraft({ assessments: draft.assessments.map((a, i) => (i === index ? { ...a, ...patch } : a)) })
  }
  function addAssessment() {
    updateDraft({
      assessments: [
        ...draft.assessments,
        {
          categoryName: '',
          fullMarks: 100,
          weightPercent: 0,
          totalGiven: 1,
          bestNCounted: 1,
          displayOrder: draft.assessments.length + 1,
        },
      ],
    })
  }
  function removeAssessment(index: number) {
    updateDraft({ assessments: draft.assessments.filter((_, i) => i !== index) })
  }

  function addAssignment(kind: OutlineAssignmentKind) {
    const next: CourseOutlineDraftAssignment = { title: '', dueDate: null, topic: null, kind }
    updateDraft({ assignments: [...draft.assignments, next] })
  }
  function updateAssignment(index: number, patch: Partial<CourseOutlineDraftAssignment>) {
    updateDraft({ assignments: draft.assignments.map((a, i) => (i === index ? { ...a, ...patch } : a)) })
  }
  function removeAssignment(index: number) {
    updateDraft({ assignments: draft.assignments.filter((_, i) => i !== index) })
  }

  const overBy = Math.round((weightSum - 100) * 10) / 10
  const underBy = Math.round((100 - weightSum) * 10) / 10

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Labeled label="Course code">
          <input
            className="fld"
            value={draft.courseCode ?? ''}
            onChange={(e) => updateDraft({ courseCode: e.target.value })}
            placeholder="e.g. CSE 3422"
          />
        </Labeled>
        <Labeled label="Course name">
          <input
            className={`fld${draft.courseTitle.trim() ? '' : ' fld-need'}`}
            value={draft.courseTitle}
            onChange={(e) => updateDraft({ courseTitle: e.target.value })}
            placeholder="Course name"
          />
        </Labeled>
        <Labeled label="Section">
          <input className="fld" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. A" />
        </Labeled>
      </div>

      <Card title="Topics" subtitle="One row per week">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {draft.topics.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1fr', gap: 8 }}>
              <input className="fld" readOnly value={t.weekNumber} aria-label={`Week ${t.weekNumber}`} style={{ textAlign: 'center' }} />
              <input
                className={`fld${t.title.trim() ? '' : ' fld-need'}`}
                value={t.title}
                onChange={(e) => updateTopic(i, e.target.value)}
                placeholder="Topic title"
              />
              <input
                className={`fld${t.description?.trim() ? '' : ' fld-need'}`}
                value={t.description ?? ''}
                onChange={(e) => updateTopicDate(i, e.target.value)}
                placeholder="Date range"
              />
            </div>
          ))}
          {draft.topics.length === 0 && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>No topics were found in the outline.</p>
          )}
        </div>
      </Card>

      <Card title="Assessments">
        <div style={{ display: 'flex', height: 8, borderRadius: 'var(--r-pill)', overflow: 'hidden', background: 'var(--surface-raised)' }}>
          {draft.assessments.map((a, i) => (
            <div
              key={i}
              style={{ flexGrow: Math.max(a.weightPercent, 0.0001), background: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }}
            />
          ))}
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: weightValid ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
          {weightValid ? 'Adds up to 100%' : `${weightSum}% of 100%`}
        </p>
        {!weightValid && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--uc-amber-l)', fontSize: 12 }}>
            <TriangleAlert size={13} strokeWidth={1.5} aria-hidden />
            <span>
              {weightSum > 100
                ? `Weights are over 100%. Lower one by ${overBy} points.`
                : `Weights are under 100%. ${underBy} points left to assign.`}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {draft.assessments.map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 28px', gap: 8, alignItems: 'center' }}>
              <input
                className={`fld${a.categoryName.trim() ? '' : ' fld-need'}`}
                value={a.categoryName}
                onChange={(e) => updateAssessment(i, { categoryName: e.target.value })}
                placeholder="Category"
              />
              <input
                className="fld"
                type="number"
                min={1}
                value={a.fullMarks}
                onChange={(e) => updateAssessment(i, { fullMarks: Number(e.target.value) })}
                aria-label={`${a.categoryName || 'Category'} full marks`}
              />
              <input
                className="fld"
                type="number"
                min={0}
                max={100}
                value={a.weightPercent}
                onChange={(e) => updateAssessment(i, { weightPercent: Number(e.target.value) })}
                style={{ borderColor: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }}
                aria-label={`${a.categoryName || 'Category'} weight percent`}
              />
              <button
                type="button"
                onClick={() => removeAssessment(i)}
                aria-label={`Remove ${a.categoryName || 'assessment'}`}
                className="press-feedback"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <GhostBtn type="button" onClick={addAssessment} style={{ alignSelf: 'flex-start' }}>
            Add assessment
          </GhostBtn>
        </div>
      </Card>

      <Card title="Assignments and class tests" subtitle={`${draft.assignments.length} items`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {draft.assignments.map((a, i) => {
            const Icon = a.kind === 'class_test' ? FileCheck : ClipboardList
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 130px 1fr 28px', gap: 8, alignItems: 'center' }}>
                <Icon size={14} strokeWidth={1.5} color="var(--text-tertiary)" aria-hidden />
                <input
                  className={`fld${a.title.trim() ? '' : ' fld-need'}`}
                  value={a.title}
                  onChange={(e) => updateAssignment(i, { title: e.target.value })}
                  placeholder="Title"
                />
                <input
                  className={`fld${a.dueDate ? '' : ' fld-need'}`}
                  type="date"
                  value={a.dueDate ?? ''}
                  onChange={(e) => updateAssignment(i, { dueDate: e.target.value || null })}
                />
                <input
                  className="fld"
                  value={a.topic ?? ''}
                  onChange={(e) => updateAssignment(i, { topic: e.target.value || null })}
                  placeholder="Topic (optional)"
                />
                <button
                  type="button"
                  onClick={() => removeAssignment(i)}
                  aria-label={`Remove ${a.title || 'item'}`}
                  className="press-feedback"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 8 }}>
            <GhostBtn type="button" onClick={() => addAssignment('assignment')}>
              Add assignment
            </GhostBtn>
            <GhostBtn type="button" onClick={() => addAssignment('class_test')}>
              Add class test
            </GhostBtn>
          </div>
        </div>
      </Card>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
        Dashed fields need your input. You can also fill them in later from inside the group.
      </p>
    </>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>{label}</span>
      {children}
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 14px',
        borderRadius: 'var(--r-md)',
        border: '0.5px solid var(--border-default)',
        background: 'var(--surface-page)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

// ── Created step ───────────────────────────────────────────────

function CreatedStep({ group, section }: { group: Group; section: string }) {
  const label = section.trim() ? `${group.name} · section ${section.trim()} is live` : `${group.name} is live`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '12px 0' }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--uc-mint-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CheckCircle2 size={24} strokeWidth={1.5} color="var(--uc-mint)" aria-hidden />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
          The outline, topics and assessments are saved. Students can join once invited.
        </p>
      </div>

      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 'var(--r-md)',
          border: '0.5px solid var(--border-default)',
          background: 'var(--surface-page)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--r-md)',
            background: 'var(--uc-orange-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <GraduationCap size={18} strokeWidth={1.5} color="var(--uc-orange-l)" aria-hidden />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.name}
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>Academic · students only · 1 member</p>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: '3px 9px',
            borderRadius: 'var(--r-pill)',
            color: 'var(--uc-orange-l)',
            background: 'var(--uc-orange-bg)',
            flexShrink: 0,
          }}
        >
          you own this
        </span>
      </div>
    </div>
  )
}

// ── Invite step ────────────────────────────────────────────────

function InviteStep({
  groupCourseTitle,
  department,
  setDepartment,
  batchYear,
  setBatchYear,
  matchCount,
  alsoInviteEmail,
  setAlsoInviteEmail,
  emailsText,
  setEmailsText,
  rosterEmails,
  inviteResult,
}: {
  groupCourseTitle: string
  department: string
  setDepartment: (v: string) => void
  batchYear: number | null
  setBatchYear: (v: number | null) => void
  matchCount: number | undefined
  alsoInviteEmail: boolean
  setAlsoInviteEmail: (v: boolean) => void
  emailsText: string
  setEmailsText: (v: string) => void
  rosterEmails: string[]
  inviteResult: BulkInviteResult | null
}) {
  const emailCount = parseEmailList(emailsText).length

  return (
    <>
      <Labeled label="Course">
        <div
          className="fld"
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}
        >
          <Lock size={13} strokeWidth={1.5} color="var(--text-tertiary)" aria-hidden />
          {groupCourseTitle}
        </div>
      </Labeled>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Labeled label="Department">
          <input className="fld" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. CSE" />
        </Labeled>
        <Labeled label="Batch year">
          <input
            className="fld"
            type="number"
            value={batchYear ?? ''}
            onChange={(e) => setBatchYear(e.target.value ? Number(e.target.value) : null)}
            placeholder="e.g. 2024"
          />
        </Labeled>
      </div>

      {matchCount != null && (department.trim() || batchYear != null) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 'var(--r-md)',
            background: 'var(--uc-indigo-bg)',
            border: '0.5px solid var(--uc-indigo-bdr)',
            fontSize: 12,
            color: 'var(--uc-indigo-xl)',
          }}
        >
          {matchCount} students match this department and batch
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Also invite by email</span>
        <Toggle checked={alsoInviteEmail} onChange={setAlsoInviteEmail} label="Also invite by email" />
      </div>

      {alsoInviteEmail && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <textarea
            className="fld"
            rows={3}
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            placeholder="One email per line"
            style={{ resize: 'vertical', lineHeight: 1.5 }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {emailsText.trim()
              ? `${emailCount} addresses added`
              : rosterEmails.length > 0
                ? 'A roster file fills this in for you'
                : '0 addresses added'}
          </span>
        </div>
      )}

      {inviteResult && (
        <Card title="Invite summary">
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{inviteResult.invited} invited · just now</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{inviteResult.skipped} skipped, already members</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{inviteResult.mailed} mailed · by email</p>
        </Card>
      )}
    </>
  )
}
