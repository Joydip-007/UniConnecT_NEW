import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('profile_education', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('institution').notNullable()
    table.text('degree').nullable()
    table.text('field_of_study').nullable()
    table.integer('start_year').notNullable()
    table.integer('end_year').nullable()
    table.text('grade').nullable()
    table.text('description').nullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.alterTable('profile_education', (table) => {
    table.index(['user_id'], 'idx_profile_edu_user')
    table.index(['university_id', 'user_id'], 'idx_profile_edu_uni')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('profile_education')
}
