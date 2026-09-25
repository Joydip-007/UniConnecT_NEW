import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { getIo } from '../../socket'
import { evaluateJobEligibility } from '@uniconnect/shared'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import { logger } from '../../utils/logger'
import { addUserAttachments, getAttachmentsFor, removeAttachments } from '../content-sync/attachments'
import type {
  ApplyJobInput,
  CreateJobInput,
  JobListQuery,
  PaginationQuery,
  UpdateApplicationInput,
  UpdateJobInput,
} from './schema'

type JobType = 'full_time' | 'part_time' | 'internship' | 'remote' | 'contract'
type ApplicationStatus =
  | 'pending'
  | 'reviewed'
  | 'shortlisted'
  | 'interviewed'
  | 'offered'
  | 'rejected'
  | 'withdrawn'

interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}

interface CountRow {
  count: string | number
}

interface JobRow {
  id: string
  university_id: string
  posted_by: string
  title: string
  company: string
  location: string
  type: JobType
  description: string
  requirements: string[] | null
  salary_range: string | null
  application_url: string | null
  deadline: Date
  is_active: boolean
  is_published: boolean
  view_count: number
  created_at: Date
  eligible_departments: string[] | null
  eligible_batches: string[] | null
  min_cgpa: string | number | null
  publish_at: Date | null
  poster_full_name: string
  poster_avatar_url: string | null
  poster_headline: string | null
  poster_role: UserRole
  application_count: string | number
  own_application_status: ApplicationStatus | null
  is_saved: boolean | null
}

interface JobOwnerRow {
  id: string
  university_id: string
  posted_by: string
  is_active: boolean
  is_published: boolean
}

interface ApplicationRow {
  id: string
  job_id: string
  applicant_id: string
  resume_url: string | null
  cover_letter: string | null
  status: ApplicationStatus
  notes: string | null
  created_at: Date
  updated_at: Date
  applicant_full_name: string
  applicant_avatar_url: string | null
  applicant_headline: string | null
  applicant_department: string | null
  applicant_batch_year: string | null
  applicant_email: string
}

interface MyApplicationRow {
  id: string
  job_id: string
  resume_url: string | null
  cover_letter: string | null
  status: ApplicationStatus
  notes: string | null
  created_at: Date
  updated_at: Date
  job_title: string
  job_company: string
  job_location: string
  job_type: JobType
  job_deadline: Date
  job_is_active: boolean
  posted_by: string
  poster_full_name: string
  poster_avatar_url: string | null
}

export class JobsService {
  async listJobs(universityId: string, userId: string, query: JobListQuery) {
    const countQuery = activeJobsBaseQuery(db, universityId)
    applyJobFilters(countQuery, query)

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await jobSelectQuery(db, userId)
      .where('jobs.university_id', universityId)
      .andWhere('jobs.is_active', true)
      .andWhere('jobs.is_published', true)
      .andWhere('jobs.deadline', '>=', db.fn.now())
      .modify(isLive)
      .modify((builder) => applyJobFilters(builder, query))
      .orderBy('jobs.deadline', 'asc')
      .orderBy('jobs.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as JobRow[]

    return { items: rows.map(toJob), total, page: query.page, limit: query.limit }
  }

  async createJob(context: AuthContext, input: CreateJobInput) {
    const jobId = await db.transaction(async (trx) => {
      const [job] = await trx('jobs')
        .insert({
          university_id: context.universityId,
          posted_by: context.userId,
          title: input.title,
          company: input.company,
          location: input.location,
          type: input.type,
          description: input.description,
          requirements: input.requirements,
          salary_range: input.salary_range ?? null,
          application_url: input.application_url ?? null,
          deadline: new Date(input.deadline),
          is_published: input.is_published ?? true,
          eligible_departments: input.eligible_departments ?? null,
          eligible_batches: input.eligible_batches ?? null,
          min_cgpa: input.min_cgpa ?? null,
          publish_at: input.publish_at ? new Date(input.publish_at) : null,
        })
        .returning<{ id: string }[]>('id')

      if (!job) throw badRequest('Job could not be created', 'JOB_CREATE_FAILED')

      await addUserAttachments(trx, {
        universityId: context.universityId,
        entityType: 'job',
        entityId: job.id,
        uploadedBy: context.userId,
        attachments: input.attachments ?? [],
      })
      return job.id
    })

    const job = await this.getJob(context.universityId, context.userId, jobId, { incrementView: false })
    // Drafts and scheduled posts are not broadcast — only live jobs reach the board.
    if (job.isPublished && !job.isScheduled) getIo().to(`uni:${context.universityId}`).emit('job:created', job)
    return job
  }

  async getJob(
    universityId: string,
    userId: string,
    jobId: string,
    options: { incrementView?: boolean } = { incrementView: true },
  ) {
    const row = await jobSelectQuery(db, userId)
      .where({ 'jobs.id': jobId, 'jobs.university_id': universityId })
      .first<JobRow>()

    if (!row || !row.is_active) throw notFound('Job not found', 'JOB_NOT_FOUND')
    // A draft job is visible only to the user who posted it.
    if (!row.is_published && row.posted_by !== userId) throw notFound('Job not found', 'JOB_NOT_FOUND')
    // So is a scheduled one, until its publish time.
    if (isScheduledRow(row) && row.posted_by !== userId) throw notFound('Job not found', 'JOB_NOT_FOUND')

    if (options.incrementView !== false) {
      void db('jobs')
        .where({ id: jobId, university_id: universityId })
        .increment('view_count', 1)
        .catch((error: unknown) => logger.warn('Failed to increment job view count', { error, jobId }))
    }

    const attachments = await getAttachmentsFor('job', jobId)
    return { ...toJob(row), attachments }
  }

  async updateJob(context: AuthContext, jobId: string, input: UpdateJobInput) {
    const job = await assertJobInUniversity(jobId, context.universityId, { includeInactive: true })
    assertCanMutateJob(context, job.posted_by)

    await db.transaction(async (trx) => {
      await trx('jobs')
        .where({ id: jobId, university_id: context.universityId })
        .update({
          ...pickDefined({
            title: input.title,
            company: input.company,
            location: input.location,
            type: input.type,
            description: input.description,
            requirements: input.requirements,
            salary_range: input.salary_range,
            application_url: input.application_url,
            deadline: input.deadline ? new Date(input.deadline) : undefined,
            is_active: input.is_active,
            is_published: input.is_published,
            eligible_departments: input.eligible_departments,
            eligible_batches: input.eligible_batches,
            min_cgpa: input.min_cgpa,
            publish_at: input.publish_at === undefined ? undefined : input.publish_at ? new Date(input.publish_at) : null,
          }),
        })

      await removeAttachments(trx, {
        universityId: context.universityId,
        entityType: 'job',
        entityId: jobId,
        ids: input.removedAttachmentIds ?? [],
      })
      await addUserAttachments(trx, {
        universityId: context.universityId,
        entityType: 'job',
        entityId: jobId,
        uploadedBy: context.userId,
        attachments: input.attachments ?? [],
      })
    })

    const publishingNow = input.is_published === true && !job.is_published
    const updated = await this.getJob(context.universityId, context.userId, jobId, { incrementView: false })
    if (publishingNow) getIo().to(`uni:${context.universityId}`).emit('job:created', updated)
    return updated
  }

  async deleteJob(context: AuthContext, jobId: string) {
    const job = await assertJobInUniversity(jobId, context.universityId, { includeInactive: true })
    assertCanMutateJob(context, job.posted_by)

    await db('jobs').where({ id: jobId, university_id: context.universityId }).update({ is_active: false })
    return { deleted: true }
  }

  async applyToJob(context: AuthContext, jobId: string, input: ApplyJobInput) {
    const job = await assertJobInUniversity(jobId, context.universityId)
    const rules = await db('jobs')
      .select<Pick<JobRow, 'requirements' | 'eligible_departments' | 'eligible_batches' | 'min_cgpa' | 'publish_at' | 'is_published' | 'posted_by'>[]>(
        'requirements',
        'eligible_departments',
        'eligible_batches',
        'min_cgpa',
        'publish_at',
        'is_published',
        'posted_by',
      )
      .where({ id: job.id })
      .first()
    if (!rules || !rules.is_published || isScheduledRow(rules)) throw notFound('Job not found', 'JOB_NOT_FOUND')

    // "Who can apply" binds students — the audience the rules are written for.
    if (context.role === 'student') {
      const me = await db('profiles')
        .select<{ department: string | null; batch_year: string | null; cgpa: string | number | null; skills: string[] | null }[]>(
          'department',
          'batch_year',
          'cgpa',
          'skills',
        )
        .where({ user_id: context.userId })
        .first()
      const verdict = evaluateJobEligibility(toEligibilityRules(rules), {
        department: me?.department ?? null,
        batchYear: me?.batch_year ?? null,
        cgpa: me?.cgpa === null || me?.cgpa === undefined ? null : Number(me.cgpa),
        skills: me?.skills ?? [],
      })
      if (!verdict.eligible) throw forbidden(verdict.failures.join(' · '), 'NOT_ELIGIBLE')
    }

    let applicationId: string
    try {
      applicationId = await db.transaction(async (trx) => {
        const [application] = await trx('job_applications')
          .insert({
            job_id: job.id,
            applicant_id: context.userId,
            resume_url: input.resume_url ?? null,
            cover_letter: input.cover_letter ?? null,
          })
          .returning<{ id: string }[]>('id')

        if (!application) throw badRequest('Application could not be created', 'APPLICATION_CREATE_FAILED')
        return application.id
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('Already applied to this job', 'ALREADY_APPLIED')
      }
      throw error
    }

    const application = await getApplicationById(applicationId)
    if (!application) throw notFound('Application not found', 'APPLICATION_NOT_FOUND')

    const payload = { jobId: job.id, applicantId: context.userId }
    getIo().to(`user:${job.posted_by}`).emit('job:new_application', payload)
    return toApplication(application)
  }

  /**
   * The applicant closes their own application. The row stays as `withdrawn` so the
   * unique (job_id, applicant_id) index keeps blocking a re-apply.
   */
  async withdrawApplication(context: AuthContext, jobId: string) {
    const job = await assertJobInUniversity(jobId, context.universityId, { includeInactive: true })

    const existing = await db('job_applications')
      .select<{ id: string; status: ApplicationStatus }[]>('id', 'status')
      .where({ job_id: jobId, applicant_id: context.userId })
      .first()
    if (!existing) throw notFound('Application not found', 'APPLICATION_NOT_FOUND')
    if (existing.status === 'withdrawn') throw conflict('Application already withdrawn', 'ALREADY_WITHDRAWN')

    await db('job_applications')
      .where({ id: existing.id })
      .update({ status: 'withdrawn', updated_at: db.fn.now() })

    const application = await getApplicationById(existing.id)
    if (!application) throw notFound('Application not found', 'APPLICATION_NOT_FOUND')

    getIo()
      .to(`user:${job.posted_by}`)
      .emit('job:application_withdrawn', { jobId: job.id, applicantId: context.userId })
    return toApplication(application)
  }

  async listJobApplications(context: AuthContext, jobId: string, query: PaginationQuery) {
    const job = await assertJobInUniversity(jobId, context.universityId, { includeInactive: true })
    assertCanMutateJob(context, job.posted_by)

    const [{ count }] = await db('job_applications').where({ job_id: jobId }).count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = await applicationSelectQuery(db)
      .where('job_applications.job_id', jobId)
      .orderBy('job_applications.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: (rows as ApplicationRow[]).map(toApplication),
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  async updateApplication(context: AuthContext, jobId: string, appId: string, input: UpdateApplicationInput) {
    const job = await assertJobInUniversity(jobId, context.universityId, { includeInactive: true })
    assertCanMutateJob(context, job.posted_by)

    const current = await db('job_applications')
      .select<{ status: ApplicationStatus }[]>('status')
      .where({ id: appId, job_id: jobId })
      .first()
    if (!current) throw notFound('Application not found', 'APPLICATION_NOT_FOUND')
    if (current.status === 'withdrawn' && input.status !== undefined) {
      throw conflict('The applicant withdrew this application', 'APPLICATION_WITHDRAWN')
    }

    const updated = await db('job_applications')
      .where({ id: appId, job_id: jobId })
      .update({
        ...pickDefined({
          status: input.status,
          notes: input.notes,
        }),
        updated_at: db.fn.now(),
      })

    if (updated === 0) throw notFound('Application not found', 'APPLICATION_NOT_FOUND')

    const application = await getApplicationById(appId)
    if (!application) throw notFound('Application not found', 'APPLICATION_NOT_FOUND')
    return toApplication(application)
  }

  async saveJob(context: AuthContext, jobId: string) {
    await assertJobInUniversity(jobId, context.universityId)

    try {
      await db('saved_jobs').insert({
        user_id: context.userId,
        job_id: jobId,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('Job already saved', 'JOB_ALREADY_SAVED')
      }
      throw error
    }

    return { saved: true }
  }

  async unsaveJob(context: AuthContext, jobId: string) {
    await assertJobInUniversity(jobId, context.universityId, { includeInactive: true })
    await db('saved_jobs').where({ user_id: context.userId, job_id: jobId }).delete()
    return { saved: false }
  }

  async listSavedJobs(universityId: string, userId: string, query: PaginationQuery) {
    const [{ count }] = await db('saved_jobs')
      .join('jobs', 'jobs.id', 'saved_jobs.job_id')
      .where({ 'saved_jobs.user_id': userId, 'jobs.university_id': universityId, 'jobs.is_active': true })
      .andWhere('jobs.deadline', '>=', db.fn.now())
      .count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await jobSelectQuery(db, userId)
      .join('saved_jobs as saved_filter', 'saved_filter.job_id', 'jobs.id')
      .where({
        'saved_filter.user_id': userId,
        'jobs.university_id': universityId,
        'jobs.is_active': true,
      })
      .andWhere('jobs.deadline', '>=', db.fn.now())
      .orderBy('saved_filter.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as JobRow[]

    return { items: rows.map(toJob), total, page: query.page, limit: query.limit }
  }

  async listMyJobs(universityId: string, userId: string, query: PaginationQuery) {
    const [{ count }] = await db('jobs')
      .where({ university_id: universityId, posted_by: userId })
      .count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await jobSelectQuery(db, userId)
      .where({ 'jobs.university_id': universityId, 'jobs.posted_by': userId })
      .orderBy('jobs.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as JobRow[]

    return { items: rows.map(toJob), total, page: query.page, limit: query.limit }
  }

  async listMyApplications(universityId: string, userId: string, query: PaginationQuery) {
    const [{ count }] = await db('job_applications')
      .join('jobs', 'jobs.id', 'job_applications.job_id')
      .where({ 'job_applications.applicant_id': userId, 'jobs.university_id': universityId })
      .count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await db('job_applications')
      .join('jobs', 'jobs.id', 'job_applications.job_id')
      .join('users', 'users.id', 'jobs.posted_by')
      .join('profiles', 'profiles.user_id', 'users.id')
      .select(
        'job_applications.id',
        'job_applications.job_id',
        'job_applications.resume_url',
        'job_applications.cover_letter',
        'job_applications.status',
        'job_applications.notes',
        'job_applications.created_at',
        'job_applications.updated_at',
        'jobs.title as job_title',
        'jobs.company as job_company',
        'jobs.location as job_location',
        'jobs.type as job_type',
        'jobs.deadline as job_deadline',
        'jobs.is_active as job_is_active',
        'jobs.posted_by',
        'profiles.full_name as poster_full_name',
        'profiles.avatar_url as poster_avatar_url',
      )
      .where({ 'job_applications.applicant_id': userId, 'jobs.university_id': universityId })
      .orderBy('job_applications.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as MyApplicationRow[]

    return { items: rows.map(toMyApplication), total, page: query.page, limit: query.limit }
  }
}

export const jobsService = new JobsService()

function activeJobsBaseQuery(knex: Knex, universityId: string) {
  return knex('jobs')
    .where('jobs.university_id', universityId)
    .andWhere('jobs.is_active', true)
    .andWhere('jobs.is_published', true)
    .andWhere('jobs.deadline', '>=', knex.fn.now())
    .modify(isLive)
}

/** A scheduled job stays off the board until its `publish_at` passes. */
function isLive(query: Knex.QueryBuilder) {
  query.andWhere((b) => b.whereNull('jobs.publish_at').orWhere('jobs.publish_at', '<=', db.fn.now()))
}

function isScheduledRow(row: { publish_at: Date | null }) {
  return !!row.publish_at && new Date(row.publish_at).getTime() > Date.now()
}

function toEligibilityRules(row: Pick<JobRow, 'requirements' | 'eligible_departments' | 'eligible_batches' | 'min_cgpa'>) {
  return {
    eligibleDepartments: row.eligible_departments,
    eligibleBatches: row.eligible_batches,
    minCgpa: row.min_cgpa === null ? null : Number(row.min_cgpa),
    requirements: row.requirements ?? [],
  }
}

function applyJobFilters(query: Knex.QueryBuilder, filters: Partial<JobListQuery>) {
  if (filters.type) query.andWhere('jobs.type', filters.type)
  if (filters.location) query.andWhereILike('jobs.location', `%${filters.location}%`)
  if (filters.search) {
    query.andWhere((builder) => {
      builder.whereILike('jobs.title', `%${filters.search}%`).orWhereILike('jobs.company', `%${filters.search}%`)
    })
  }
}

function jobSelectQuery(knex: Knex, userId: string) {
  return knex('jobs')
    .join('users', 'users.id', 'jobs.posted_by')
    .join('profiles', 'profiles.user_id', 'users.id')
    .leftJoin('saved_jobs', function joinSaved() {
      this.on('saved_jobs.job_id', '=', 'jobs.id').andOn('saved_jobs.user_id', '=', knex.raw('?', [userId]))
    })
    .select<JobRow[]>(
      'jobs.id',
      'jobs.university_id',
      'jobs.posted_by',
      'jobs.title',
      'jobs.company',
      'jobs.location',
      'jobs.type',
      'jobs.description',
      'jobs.requirements',
      'jobs.salary_range',
      'jobs.application_url',
      'jobs.deadline',
      'jobs.is_active',
      'jobs.is_published',
      'jobs.view_count',
      'jobs.created_at',
      'jobs.eligible_departments',
      'jobs.eligible_batches',
      'jobs.min_cgpa',
      'jobs.publish_at',
      'profiles.full_name as poster_full_name',
      'profiles.avatar_url as poster_avatar_url',
      'profiles.headline as poster_headline',
      'users.role as poster_role',
      knex.raw(
        '(SELECT COUNT(*)::int FROM job_applications WHERE job_applications.job_id = jobs.id) AS application_count',
      ),
      knex.raw(
        '(SELECT status FROM job_applications WHERE job_applications.job_id = jobs.id AND applicant_id = ? LIMIT 1) AS own_application_status',
        [userId],
      ),
      knex.raw('saved_jobs.user_id IS NOT NULL AS is_saved'),
    )
}

function applicationSelectQuery(knex: Knex) {
  return knex('job_applications')
    .join('users', 'users.id', 'job_applications.applicant_id')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select<ApplicationRow[]>(
      'job_applications.id',
      'job_applications.job_id',
      'job_applications.applicant_id',
      'job_applications.resume_url',
      'job_applications.cover_letter',
      'job_applications.status',
      'job_applications.notes',
      'job_applications.created_at',
      'job_applications.updated_at',
      'profiles.full_name as applicant_full_name',
      'profiles.avatar_url as applicant_avatar_url',
      'profiles.headline as applicant_headline',
      'profiles.department as applicant_department',
      'profiles.batch_year as applicant_batch_year',
      'users.email as applicant_email',
    )
}

async function assertJobInUniversity(
  jobId: string,
  universityId: string,
  options: { includeInactive?: boolean } = {},
) {
  const query = db('jobs')
    .select<JobOwnerRow[]>('id', 'university_id', 'posted_by', 'is_active', 'is_published')
    .where({ id: jobId, university_id: universityId })

  if (!options.includeInactive) query.andWhere('is_active', true)

  const job = await query.first()
  if (!job) throw notFound('Job not found', 'JOB_NOT_FOUND')
  return job
}

async function getApplicationById(applicationId: string) {
  return applicationSelectQuery(db).where('job_applications.id', applicationId).first<ApplicationRow>()
}

function assertCanMutateJob(context: AuthContext, postedBy: string) {
  if (context.userId === postedBy || context.role === 'admin') return
  throw forbidden('You do not have permission to modify this job', 'JOB_FORBIDDEN')
}

function toJob(row: JobRow) {
  return {
    id: row.id,
    universityId: row.university_id,
    postedById: row.posted_by,
    title: row.title,
    company: row.company,
    location: row.location,
    type: row.type,
    description: row.description,
    salaryRange: row.salary_range,
    applicationUrl: row.application_url,
    deadline: row.deadline,
    isActive: row.is_active,
    isPublished: row.is_published,
    viewCount: row.view_count,
    createdAt: row.created_at,
    ...toEligibilityRules(row),
    publishAt: row.publish_at,
    isScheduled: isScheduledRow(row),
    postedByUser: {
      id: row.posted_by,
      fullName: row.poster_full_name,
      avatarUrl: row.poster_avatar_url,
      headline: row.poster_headline,
      role: row.poster_role,
    },
    postedBy: {
      id: row.posted_by,
      fullName: row.poster_full_name,
      role: row.poster_role,
      profile: {
        avatarUrl: row.poster_avatar_url,
        headline: row.poster_headline,
        department: null,
      },
    },
    applicationCount: Number(row.application_count),
    ownApplicationStatus: row.own_application_status,
    myApplication: row.own_application_status ? { status: row.own_application_status } : null,
    isSaved: Boolean(row.is_saved),
  }
}

function toApplication(row: ApplicationRow) {
  return {
    id: row.id,
    jobId: row.job_id,
    applicantId: row.applicant_id,
    resumeUrl: row.resume_url,
    coverLetter: row.cover_letter,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    appliedAt: row.created_at,
    updatedAt: row.updated_at,
    applicant: {
      id: row.applicant_id,
      email: row.applicant_email,
      fullName: row.applicant_full_name,
      avatarUrl: row.applicant_avatar_url,
      headline: row.applicant_headline,
      department: row.applicant_department,
      batchYear: row.applicant_batch_year,
      profile: {
        avatarUrl: row.applicant_avatar_url,
        headline: row.applicant_headline,
        department: row.applicant_department,
      },
    },
  }
}

function toMyApplication(row: MyApplicationRow) {
  return {
    id: row.id,
    jobId: row.job_id,
    resumeUrl: row.resume_url,
    coverLetter: row.cover_letter,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    job: {
      id: row.job_id,
      title: row.job_title,
      company: row.job_company,
      location: row.job_location,
      type: row.job_type,
      deadline: row.job_deadline,
      isActive: row.job_is_active,
      postedBy: {
        id: row.posted_by,
        fullName: row.poster_full_name,
        avatarUrl: row.poster_avatar_url,
      },
    },
  }
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
