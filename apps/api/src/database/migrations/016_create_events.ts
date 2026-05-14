import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('organizer_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('group_id')
    table.string('title', 255).notNullable()
    table.text('description').notNullable()
    table.string('location', 255).notNullable()
    table.boolean('is_online').defaultTo(false)
    table.text('online_link')
    table.text('cover_url')
    table.timestamp('starts_at', { useTz: true }).notNullable()
    table.timestamp('ends_at', { useTz: true })
    table.integer('capacity')
    table.string('type', 30).notNullable().defaultTo('general')
    table.boolean('is_published').defaultTo(false)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.raw(
    "ALTER TABLE events ADD CONSTRAINT events_type_check CHECK (type IN ('general', 'career_fair', 'seminar', 'alumni_meetup', 'workshop', 'club'))",
  )
  await knex.raw('ALTER TABLE events ADD CONSTRAINT events_capacity_check CHECK (capacity IS NULL OR capacity > 0)')

  await knex.schema.createTable('event_rsvps', (table) => {
    table.uuid('event_id').notNullable().references('id').inTable('events').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('status', 20).notNullable().defaultTo('going')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.primary(['event_id', 'user_id'])
  })

  await knex.raw(
    "ALTER TABLE event_rsvps ADD CONSTRAINT event_rsvps_status_check CHECK (status IN ('going', 'maybe', 'not_going'))",
  )

  await knex.schema.alterTable('events', (table) => {
    table.index(['university_id', 'starts_at'], 'idx_events_university')
    table.index(['organizer_id'], 'idx_events_organizer')
  })
  await knex.schema.alterTable('event_rsvps', (table) => {
    table.index(['user_id'], 'idx_event_rsvps_user')
    table.index(['status'], 'idx_event_rsvps_status')
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('event_rsvps')
  await knex.schema.dropTableIfExists('events')
}
