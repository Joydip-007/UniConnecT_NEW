import type { Knex } from 'knex'

/**
 * Jobs redesign (Jobs Page.dc.html):
 * - "Who can apply" — a job may restrict applicants by department, batch and minimum
 *   CGPA. Null / empty means unrestricted on that axis.
 * - Scheduled publishing — `publish_at` in the future hides the job from the board
 *   until then; visibility is a query filter, so no worker is needed.
 * - Profile CGPA and resume — the apply flow reads both from the applicant's profile.
 *   Owner-only fields: never returned to other viewers.
 * - Withdrawn applications — an applicant can withdraw; the row stays (status
 *   `withdrawn`) so the unique (job_id, applicant_id) index blocks a re-apply.
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('jobs', (table) => {
    table.specificType('eligible_departments', 'text[]')
    table.specificType('eligible_batches', 'text[]')
    table.decimal('min_cgpa', 3, 2)
    table.timestamp('publish_at', { useTz: true })
  })
  await knex.schema.alterTable('profiles', (table) => {
    table.decimal('cgpa', 3, 2)
    table.text('resume_url')
    table.string('resume_name', 255)
    table.timestamp('resume_updated_at', { useTz: true })
  })

  await knex.raw('ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_status_check')
  await knex.raw(
    "ALTER TABLE job_applications ADD CONSTRAINT job_applications_status_check CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'interviewed', 'offered', 'rejected', 'withdrawn'))",
  )
}

export async function down(knex: Knex) {
  // Drop the constraint, fold the rows, then re-add it narrowed — in that order.
  await knex.raw('ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_status_check')
  // The application is closed either way; `rejected` keeps the row (and its re-apply
  // block) rather than deleting what the poster already saw.
  await knex('job_applications').where({ status: 'withdrawn' }).update({ status: 'rejected' })
  await knex.raw(
    "ALTER TABLE job_applications ADD CONSTRAINT job_applications_status_check CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'interviewed', 'offered', 'rejected'))",
  )

  await knex.schema.alterTable('profiles', (table) => {
    table.dropColumn('resume_updated_at')
    table.dropColumn('resume_name')
    table.dropColumn('resume_url')
    table.dropColumn('cgpa')
  })
  await knex.schema.alterTable('jobs', (table) => {
    table.dropColumn('publish_at')
    table.dropColumn('min_cgpa')
    table.dropColumn('eligible_batches')
    table.dropColumn('eligible_departments')
  })
}
