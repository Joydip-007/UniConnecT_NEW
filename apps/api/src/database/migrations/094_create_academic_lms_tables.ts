import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('gradebook_entries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('assessment_id').notNullable().references('id').inTable('course_outline_assessments').onDelete('CASCADE')
    table.integer('instance_number').notNullable().defaultTo(1)
    table.decimal('marks_obtained', 6, 2)
    table.uuid('graded_by').references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('graded_at', { useTz: true })
    table.text('notes')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.unique(['group_id', 'student_id', 'assessment_id', 'instance_number'])
  })

  await knex.schema.alterTable('gradebook_entries', (table) => {
    table.index(['university_id'], 'gradebook_university_idx')
    table.index(['group_id', 'student_id'], 'gradebook_group_student_idx')
    table.index(['assessment_id', 'instance_number'], 'gradebook_assessment_idx')
  })

  await knex.schema.createTable('academic_group_modules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL')
    table.string('title', 255).notNullable()
    table.text('description')
    table.integer('week_number')
    table.integer('display_order').notNullable().defaultTo(1)
    table.boolean('is_published').notNullable().defaultTo(false)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.schema.alterTable('academic_group_modules', (table) => {
    table.index(['university_id'], 'modules_university_idx')
    table.index(['group_id', 'display_order'], 'modules_group_order_idx')
  })

  await knex.schema.createTable('academic_assignments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('module_id').references('id').inTable('academic_group_modules').onDelete('SET NULL')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL')
    table.string('title', 255).notNullable()
    table.text('description')
    table.jsonb('file_urls').notNullable().defaultTo('[]')
    table.timestamp('deadline', { useTz: true })
    table.integer('max_score').notNullable().defaultTo(100)
    table.boolean('is_published').notNullable().defaultTo(false)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.schema.alterTable('academic_assignments', (table) => {
    table.index(['university_id'], 'assignments_university_idx')
    table.index(['group_id', 'deadline'], 'assignments_group_deadline_idx')
  })

  await knex.schema.createTable('academic_submissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('assignment_id').notNullable().references('id').inTable('academic_assignments').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.jsonb('file_urls').notNullable().defaultTo('[]')
    table.text('text_content')
    table.integer('score')
    table.text('feedback')
    table.uuid('graded_by').references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('submitted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('graded_at', { useTz: true })
    table.boolean('is_late').notNullable().defaultTo(false)
    table.unique(['assignment_id', 'user_id'])
  })
  await knex.schema.alterTable('academic_submissions', (table) => {
    table.index(['university_id'], 'submissions_university_idx')
    table.index(['assignment_id', 'user_id'], 'submissions_assignment_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('academic_submissions')
  await knex.schema.dropTableIfExists('academic_assignments')
  await knex.schema.dropTableIfExists('academic_group_modules')
  await knex.schema.dropTableIfExists('gradebook_entries')
}
