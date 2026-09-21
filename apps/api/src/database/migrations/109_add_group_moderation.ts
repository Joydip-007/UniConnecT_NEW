import type { Knex } from 'knex'

/**
 * Group-level moderation (109).
 *  - Two admin toggles on `groups`.
 *  - A review status on posts/events. NULL = never needed review (the common case).
 *    A 'pending' row is stored with is_published=false so every existing public
 *    filter hides it; approving flips both.
 *  - Announcements (academic LMS), a moderation log, and consultation slots/bookings.
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('groups', (t) => {
    t.boolean('require_post_approval').notNullable().defaultTo(false)
    t.boolean('require_event_approval').notNullable().defaultTo(false)
  })

  for (const table of ['posts', 'events'] as const) {
    await knex.schema.alterTable(table, (t) => {
      t.string('group_review_status', 10).nullable()
    })
    await knex.raw(
      `ALTER TABLE ${table} ADD CONSTRAINT ${table}_group_review_status_check
       CHECK (group_review_status IS NULL OR group_review_status IN ('pending','approved','declined'))`,
    )
    await knex.raw(
      `CREATE INDEX idx_${table}_group_review ON ${table} (group_id, group_review_status)
       WHERE group_review_status = 'pending'`,
    )
  }

  await knex.schema.createTable('group_announcements', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    t.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    t.uuid('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.string('title', 255).notNullable()
    t.text('body').notNullable()
    t.string('kind', 10).notNullable().defaultTo('notice')
    t.boolean('is_pinned').notNullable().defaultTo(false)
    t.boolean('notify_members').notNullable().defaultTo(false)
    t.jsonb('attachments').notNullable().defaultTo('[]')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.raw(`ALTER TABLE group_announcements ADD CONSTRAINT group_announcements_kind_check
                  CHECK (kind IN ('urgent','schedule','notice'))`)
  await knex.raw(`CREATE INDEX idx_group_announcements_group ON group_announcements (group_id, is_pinned DESC, created_at DESC)`)

  await knex.schema.createTable('group_moderation_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    t.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    t.uuid('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL')
    t.string('kind', 10).notNullable() // post | member | settings
    t.string('action', 80).notNullable() // "Post removed"
    t.text('target').notNullable() // "Mahin Khan · repeated sponsor link"
    t.uuid('target_user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.raw(`ALTER TABLE group_moderation_log ADD CONSTRAINT group_moderation_log_kind_check
                  CHECK (kind IN ('post','member','settings'))`)
  await knex.raw(`CREATE INDEX idx_group_moderation_log_group ON group_moderation_log (group_id, created_at DESC)`)

  await knex.schema.createTable('group_consultation_slots', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    t.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    t.uuid('teacher_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.integer('weekday').notNullable() // 0..6, 0 = Sunday
    t.string('start_time', 5).notNullable() // "15:00"
    t.string('end_time', 5).notNullable()
    t.string('location', 255).notNullable()
    t.boolean('walk_in').notNullable().defaultTo(false)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.raw(`CREATE INDEX idx_group_consultation_slots_group ON group_consultation_slots (group_id, weekday, start_time)`)

  await knex.schema.createTable('group_consultation_bookings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    t.uuid('slot_id').notNullable().references('id').inTable('group_consultation_slots').onDelete('CASCADE')
    t.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.date('booked_for').notNullable()
    t.text('topic').notNullable()
    t.string('status', 10).notNullable().defaultTo('requested') // requested | confirmed | declined
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['slot_id', 'student_id', 'booked_for'])
  })
  await knex.raw(`ALTER TABLE group_consultation_bookings ADD CONSTRAINT group_consultation_bookings_status_check
                  CHECK (status IN ('requested','confirmed','declined'))`)
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('group_consultation_bookings')
  await knex.schema.dropTableIfExists('group_consultation_slots')
  await knex.schema.dropTableIfExists('group_moderation_log')
  await knex.schema.dropTableIfExists('group_announcements')
  for (const table of ['posts', 'events'] as const) {
    // Pending rows were unpublished on purpose; with the column gone they would become
    // ordinary drafts. Convert them back to published so nothing silently disappears.
    await knex(table).where({ group_review_status: 'pending' }).update({ is_published: true })
    await knex.raw(`DROP INDEX IF EXISTS idx_${table}_group_review`)
    await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_group_review_status_check`)
    await knex.schema.alterTable(table, (t) => t.dropColumn('group_review_status'))
  }
  await knex.schema.alterTable('groups', (t) => {
    t.dropColumn('require_post_approval')
    t.dropColumn('require_event_approval')
  })
}
