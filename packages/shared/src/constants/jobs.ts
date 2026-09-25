// Jobs — "Who can apply" rules and the eligibility check both apps run.
// The API enforces it on apply; the web app runs the same function to render the
// Eligible / Not eligible banner and the apply modal's requirements check.

/** Departments offered as chips in the post-a-job form. Profiles store free text. */
export const JOB_DEPARTMENTS = ['CSE', 'EEE', 'Civil', 'BBA', 'Economics', 'English', 'Pharmacy', 'MSJ'] as const

export const JOB_MIN_CGPA_OPTIONS = [2.5, 3, 3.25, 3.5, 3.75] as const

export const APPLICATION_STATUSES = [
  'pending',
  'reviewed',
  'shortlisted',
  'interviewed',
  'offered',
  'rejected',
  'withdrawn',
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/** Statuses a poster can set. `withdrawn` belongs to the applicant alone. */
export const POSTER_APPLICATION_STATUSES = APPLICATION_STATUSES.filter(
  (s): s is Exclude<ApplicationStatus, 'withdrawn'> => s !== 'withdrawn',
)

export interface JobEligibilityRules {
  eligibleDepartments: string[] | null
  eligibleBatches: string[] | null
  minCgpa: number | null
  requirements: string[]
}

export interface ApplicantFacts {
  department: string | null
  batchYear: string | null
  cgpa: number | null
  skills: string[]
}

export interface EligibilityCheck {
  key: 'department' | 'batch' | 'cgpa' | 'skills'
  label: string
  detail: string
  ok: boolean
}

export interface JobEligibility {
  /** False only when a hard rule (department, batch, CGPA) fails. Skills never block. */
  eligible: boolean
  /** Human-readable reasons for each failed hard rule. */
  failures: string[]
  matchedSkills: string[]
  missingSkills: string[]
  checks: EligibilityCheck[]
  /** A CGPA rule exists but the applicant has none on file — allowed, flagged. */
  cgpaUnknown: boolean
}

const norm = (s: string) => s.trim().toLowerCase()

export function evaluateJobEligibility(job: JobEligibilityRules, me: ApplicantFacts): JobEligibility {
  const depts = job.eligibleDepartments?.filter(Boolean) ?? []
  const batches = job.eligibleBatches?.filter(Boolean) ?? []
  const minCgpa = job.minCgpa && job.minCgpa > 0 ? job.minCgpa : null

  const deptOk = depts.length === 0 || (!!me.department && depts.some((d) => norm(d) === norm(me.department!)))
  const batchOk = batches.length === 0 || (!!me.batchYear && batches.some((b) => norm(b) === norm(me.batchYear!)))
  const cgpaUnknown = minCgpa !== null && me.cgpa === null
  const cgpaOk = minCgpa === null || me.cgpa === null || me.cgpa >= minCgpa

  const failures: string[] = []
  if (!deptOk) failures.push(`Open to ${depts.join(', ')} only`)
  if (!batchOk) failures.push(`Batch ${batches.join(', ')} only`)
  if (!cgpaOk) failures.push(`Needs CGPA ${minCgpa!.toFixed(2)}+, yours is ${me.cgpa!.toFixed(2)}`)

  const mine = new Set(me.skills.map(norm))
  const matchedSkills = job.requirements.filter((r) => mine.has(norm(r)))
  const missingSkills = job.requirements.filter((r) => !mine.has(norm(r)))

  const checks: EligibilityCheck[] = [
    { key: 'department', label: 'Department', detail: depts.length ? depts.join(', ') : 'Any', ok: deptOk },
    { key: 'batch', label: 'Graduation batch', detail: batches.length ? batches.join(', ') : 'Any', ok: batchOk },
    {
      key: 'cgpa',
      label: 'Minimum CGPA',
      detail:
        minCgpa === null
          ? 'None'
          : me.cgpa === null
            ? `${minCgpa.toFixed(2)} · add yours to your profile`
            : `${minCgpa.toFixed(2)} · yours ${me.cgpa.toFixed(2)}`,
      ok: cgpaOk && !cgpaUnknown,
    },
    {
      key: 'skills',
      label: 'Skills',
      detail: `${matchedSkills.length} of ${job.requirements.length}`,
      ok: missingSkills.length === 0,
    },
  ]

  return { eligible: failures.length === 0, failures, matchedSkills, missingSkills, checks, cgpaUnknown }
}
