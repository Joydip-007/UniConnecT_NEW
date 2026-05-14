"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('jobs', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE');
        table.uuid('posted_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('title', 255).notNullable();
        table.string('company', 255).notNullable();
        table.string('location', 255).notNullable();
        table.string('type', 30).notNullable();
        table.text('description').notNullable();
        table.specificType('requirements', 'text[]');
        table.string('salary_range', 100);
        table.text('application_url');
        table.timestamp('deadline', { useTz: true }).notNullable();
        table.boolean('is_active').defaultTo(true);
        table.integer('view_count').defaultTo(0);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
    await knex.raw("ALTER TABLE jobs ADD CONSTRAINT jobs_type_check CHECK (type IN ('full_time', 'part_time', 'internship', 'remote', 'contract'))");
    await knex.schema.createTable('job_applications', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('job_id').notNullable().references('id').inTable('jobs').onDelete('CASCADE');
        table.uuid('applicant_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.text('resume_url');
        table.text('cover_letter');
        table.string('status', 30).notNullable().defaultTo('pending');
        table.text('notes');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.unique(['job_id', 'applicant_id'], 'uq_job_applications_job_applicant');
    });
    await knex.raw("ALTER TABLE job_applications ADD CONSTRAINT job_applications_status_check CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'interviewed', 'offered', 'rejected'))");
    await knex.schema.createTable('saved_jobs', (table) => {
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('job_id').notNullable().references('id').inTable('jobs').onDelete('CASCADE');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.primary(['user_id', 'job_id']);
    });
    await knex.schema.alterTable('jobs', (table) => {
        table.index(['university_id'], 'idx_jobs_university');
        table.index(['is_active', 'deadline'], 'idx_jobs_active');
        table.index(['posted_by'], 'idx_jobs_posted_by');
    });
    await knex.schema.alterTable('job_applications', (table) => {
        table.index(['job_id'], 'idx_job_applications_job');
        table.index(['applicant_id'], 'idx_job_applications_applicant');
    });
    await knex.schema.alterTable('saved_jobs', (table) => {
        table.index(['job_id'], 'idx_saved_jobs_job');
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('saved_jobs');
    await knex.schema.dropTableIfExists('job_applications');
    await knex.schema.dropTableIfExists('jobs');
}
