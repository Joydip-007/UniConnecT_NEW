"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobsService = exports.JobsService = void 0;
const db_1 = require("../../config/db");
const socket_1 = require("../../socket");
const errors_1 = require("../../utils/errors");
const logger_1 = require("../../utils/logger");
class JobsService {
    async listJobs(universityId, userId, query) {
        const countQuery = activeJobsBaseQuery(db_1.db, universityId);
        applyJobFilters(countQuery, query);
        const [{ count }] = await countQuery.count({ count: '*' });
        const total = Number(count);
        const rows = (await jobSelectQuery(db_1.db, userId)
            .where('jobs.university_id', universityId)
            .andWhere('jobs.is_active', true)
            .andWhere('jobs.deadline', '>=', db_1.db.fn.now())
            .modify((builder) => applyJobFilters(builder, query))
            .orderBy('jobs.deadline', 'asc')
            .orderBy('jobs.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit));
        return { items: rows.map(toJob), total, page: query.page, limit: query.limit };
    }
    async createJob(context, input) {
        const jobId = await db_1.db.transaction(async (trx) => {
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
            })
                .returning('id');
            if (!job)
                throw (0, errors_1.badRequest)('Job could not be created', 'JOB_CREATE_FAILED');
            return job.id;
        });
        const job = await this.getJob(context.universityId, context.userId, jobId, { incrementView: false });
        (0, socket_1.getIo)().to(`uni:${context.universityId}`).emit('job:created', job);
        return job;
    }
    async getJob(universityId, userId, jobId, options = { incrementView: true }) {
        const row = await jobSelectQuery(db_1.db, userId)
            .where({ 'jobs.id': jobId, 'jobs.university_id': universityId })
            .first();
        if (!row || !row.is_active)
            throw (0, errors_1.notFound)('Job not found', 'JOB_NOT_FOUND');
        if (options.incrementView !== false) {
            void (0, db_1.db)('jobs')
                .where({ id: jobId, university_id: universityId })
                .increment('view_count', 1)
                .catch((error) => logger_1.logger.warn('Failed to increment job view count', { error, jobId }));
        }
        return toJob(row);
    }
    async updateJob(context, jobId, input) {
        const job = await assertJobInUniversity(jobId, context.universityId, { includeInactive: true });
        assertCanMutateJob(context, job.posted_by);
        await (0, db_1.db)('jobs')
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
            }),
        });
        return this.getJob(context.universityId, context.userId, jobId, { incrementView: false });
    }
    async deleteJob(context, jobId) {
        const job = await assertJobInUniversity(jobId, context.universityId, { includeInactive: true });
        assertCanMutateJob(context, job.posted_by);
        await (0, db_1.db)('jobs').where({ id: jobId, university_id: context.universityId }).update({ is_active: false });
        return { deleted: true };
    }
    async applyToJob(context, jobId, input) {
        const job = await assertJobInUniversity(jobId, context.universityId);
        let applicationId;
        try {
            applicationId = await db_1.db.transaction(async (trx) => {
                const [application] = await trx('job_applications')
                    .insert({
                    job_id: job.id,
                    applicant_id: context.userId,
                    resume_url: input.resume_url ?? null,
                    cover_letter: input.cover_letter ?? null,
                })
                    .returning('id');
                if (!application)
                    throw (0, errors_1.badRequest)('Application could not be created', 'APPLICATION_CREATE_FAILED');
                return application.id;
            });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw (0, errors_1.conflict)('Already applied to this job', 'ALREADY_APPLIED');
            }
            throw error;
        }
        const application = await getApplicationById(applicationId);
        if (!application)
            throw (0, errors_1.notFound)('Application not found', 'APPLICATION_NOT_FOUND');
        const payload = { jobId: job.id, applicantId: context.userId };
        (0, socket_1.getIo)().to(`user:${job.posted_by}`).emit('job:new_application', payload);
        return toApplication(application);
    }
    async listJobApplications(context, jobId, query) {
        const job = await assertJobInUniversity(jobId, context.universityId, { includeInactive: true });
        assertCanMutateJob(context, job.posted_by);
        const [{ count }] = await (0, db_1.db)('job_applications').where({ job_id: jobId }).count({ count: '*' });
        const total = Number(count);
        const rows = await applicationSelectQuery(db_1.db)
            .where('job_applications.job_id', jobId)
            .orderBy('job_applications.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toApplication),
            total,
            page: query.page,
            limit: query.limit,
        };
    }
    async updateApplication(context, jobId, appId, input) {
        const job = await assertJobInUniversity(jobId, context.universityId, { includeInactive: true });
        assertCanMutateJob(context, job.posted_by);
        const updated = await (0, db_1.db)('job_applications')
            .where({ id: appId, job_id: jobId })
            .update({
            ...pickDefined({
                status: input.status,
                notes: input.notes,
            }),
            updated_at: db_1.db.fn.now(),
        });
        if (updated === 0)
            throw (0, errors_1.notFound)('Application not found', 'APPLICATION_NOT_FOUND');
        const application = await getApplicationById(appId);
        if (!application)
            throw (0, errors_1.notFound)('Application not found', 'APPLICATION_NOT_FOUND');
        return toApplication(application);
    }
    async saveJob(context, jobId) {
        await assertJobInUniversity(jobId, context.universityId);
        try {
            await (0, db_1.db)('saved_jobs').insert({
                user_id: context.userId,
                job_id: jobId,
            });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw (0, errors_1.conflict)('Job already saved', 'JOB_ALREADY_SAVED');
            }
            throw error;
        }
        return { saved: true };
    }
    async unsaveJob(context, jobId) {
        await assertJobInUniversity(jobId, context.universityId, { includeInactive: true });
        await (0, db_1.db)('saved_jobs').where({ user_id: context.userId, job_id: jobId }).delete();
        return { saved: false };
    }
    async listSavedJobs(universityId, userId, query) {
        const [{ count }] = await (0, db_1.db)('saved_jobs')
            .join('jobs', 'jobs.id', 'saved_jobs.job_id')
            .where({ 'saved_jobs.user_id': userId, 'jobs.university_id': universityId, 'jobs.is_active': true })
            .andWhere('jobs.deadline', '>=', db_1.db.fn.now())
            .count({ count: '*' });
        const total = Number(count);
        const rows = (await jobSelectQuery(db_1.db, userId)
            .join('saved_jobs as saved_filter', 'saved_filter.job_id', 'jobs.id')
            .where({
            'saved_filter.user_id': userId,
            'jobs.university_id': universityId,
            'jobs.is_active': true,
        })
            .andWhere('jobs.deadline', '>=', db_1.db.fn.now())
            .orderBy('saved_filter.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit));
        return { items: rows.map(toJob), total, page: query.page, limit: query.limit };
    }
    async listMyJobs(universityId, userId, query) {
        const [{ count }] = await (0, db_1.db)('jobs')
            .where({ university_id: universityId, posted_by: userId })
            .count({ count: '*' });
        const total = Number(count);
        const rows = (await jobSelectQuery(db_1.db, userId)
            .where({ 'jobs.university_id': universityId, 'jobs.posted_by': userId })
            .orderBy('jobs.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit));
        return { items: rows.map(toJob), total, page: query.page, limit: query.limit };
    }
    async listMyApplications(universityId, userId, query) {
        const [{ count }] = await (0, db_1.db)('job_applications')
            .join('jobs', 'jobs.id', 'job_applications.job_id')
            .where({ 'job_applications.applicant_id': userId, 'jobs.university_id': universityId })
            .count({ count: '*' });
        const total = Number(count);
        const rows = (await (0, db_1.db)('job_applications')
            .join('jobs', 'jobs.id', 'job_applications.job_id')
            .join('users', 'users.id', 'jobs.posted_by')
            .join('profiles', 'profiles.user_id', 'users.id')
            .select('job_applications.id', 'job_applications.job_id', 'job_applications.resume_url', 'job_applications.cover_letter', 'job_applications.status', 'job_applications.notes', 'job_applications.created_at', 'job_applications.updated_at', 'jobs.title as job_title', 'jobs.company as job_company', 'jobs.location as job_location', 'jobs.type as job_type', 'jobs.deadline as job_deadline', 'jobs.is_active as job_is_active', 'jobs.posted_by', 'profiles.full_name as poster_full_name', 'profiles.avatar_url as poster_avatar_url')
            .where({ 'job_applications.applicant_id': userId, 'jobs.university_id': universityId })
            .orderBy('job_applications.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit));
        return { items: rows.map(toMyApplication), total, page: query.page, limit: query.limit };
    }
}
exports.JobsService = JobsService;
exports.jobsService = new JobsService();
function activeJobsBaseQuery(knex, universityId) {
    return knex('jobs')
        .where('jobs.university_id', universityId)
        .andWhere('jobs.is_active', true)
        .andWhere('jobs.deadline', '>=', knex.fn.now());
}
function applyJobFilters(query, filters) {
    if (filters.type)
        query.andWhere('jobs.type', filters.type);
    if (filters.location)
        query.andWhereILike('jobs.location', `%${filters.location}%`);
    if (filters.search) {
        query.andWhere((builder) => {
            builder.whereILike('jobs.title', `%${filters.search}%`).orWhereILike('jobs.company', `%${filters.search}%`);
        });
    }
}
function jobSelectQuery(knex, userId) {
    return knex('jobs')
        .join('users', 'users.id', 'jobs.posted_by')
        .join('profiles', 'profiles.user_id', 'users.id')
        .leftJoin('saved_jobs', function joinSaved() {
        this.on('saved_jobs.job_id', '=', 'jobs.id').andOn('saved_jobs.user_id', '=', knex.raw('?', [userId]));
    })
        .select('jobs.id', 'jobs.university_id', 'jobs.posted_by', 'jobs.title', 'jobs.company', 'jobs.location', 'jobs.type', 'jobs.description', 'jobs.requirements', 'jobs.salary_range', 'jobs.application_url', 'jobs.deadline', 'jobs.is_active', 'jobs.view_count', 'jobs.created_at', 'profiles.full_name as poster_full_name', 'profiles.avatar_url as poster_avatar_url', 'profiles.headline as poster_headline', 'users.role as poster_role', knex.raw('(SELECT COUNT(*)::int FROM job_applications WHERE job_applications.job_id = jobs.id) AS application_count'), knex.raw('(SELECT status FROM job_applications WHERE job_applications.job_id = jobs.id AND applicant_id = ? LIMIT 1) AS own_application_status', [userId]), knex.raw('saved_jobs.user_id IS NOT NULL AS is_saved'));
}
function applicationSelectQuery(knex) {
    return knex('job_applications')
        .join('users', 'users.id', 'job_applications.applicant_id')
        .join('profiles', 'profiles.user_id', 'users.id')
        .select('job_applications.id', 'job_applications.job_id', 'job_applications.applicant_id', 'job_applications.resume_url', 'job_applications.cover_letter', 'job_applications.status', 'job_applications.notes', 'job_applications.created_at', 'job_applications.updated_at', 'profiles.full_name as applicant_full_name', 'profiles.avatar_url as applicant_avatar_url', 'profiles.headline as applicant_headline', 'profiles.department as applicant_department', 'profiles.batch_year as applicant_batch_year', 'users.email as applicant_email');
}
async function assertJobInUniversity(jobId, universityId, options = {}) {
    const query = (0, db_1.db)('jobs')
        .select('id', 'university_id', 'posted_by', 'is_active')
        .where({ id: jobId, university_id: universityId });
    if (!options.includeInactive)
        query.andWhere('is_active', true);
    const job = await query.first();
    if (!job)
        throw (0, errors_1.notFound)('Job not found', 'JOB_NOT_FOUND');
    return job;
}
async function getApplicationById(applicationId) {
    return applicationSelectQuery(db_1.db).where('job_applications.id', applicationId).first();
}
function assertCanMutateJob(context, postedBy) {
    if (context.userId === postedBy || context.role === 'admin')
        return;
    throw (0, errors_1.forbidden)('You do not have permission to modify this job', 'JOB_FORBIDDEN');
}
function toJob(row) {
    return {
        id: row.id,
        universityId: row.university_id,
        postedById: row.posted_by,
        title: row.title,
        company: row.company,
        location: row.location,
        type: row.type,
        description: row.description,
        requirements: row.requirements ?? [],
        salaryRange: row.salary_range,
        applicationUrl: row.application_url,
        deadline: row.deadline,
        isActive: row.is_active,
        viewCount: row.view_count,
        createdAt: row.created_at,
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
    };
}
function toApplication(row) {
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
    };
}
function toMyApplication(row) {
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
    };
}
function pickDefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
function isUniqueViolation(error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
