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
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('gradebook_entries')
}
