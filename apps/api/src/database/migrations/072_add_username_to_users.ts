import type { Knex } from 'knex'

// Per-university-unique, user-facing handle powering vanity profile URLs
// (`/profile/<username>`). Added nullable, backfilled from the email local-part,
// then tightened to a case-insensitive per-tenant unique index + NOT NULL.
//
// Normalization rules are kept in sync with `usernameSchema` in
// `@uniconnect/shared`, but inlined here so the migration stays self-contained.

const RESERVED = new Set([
  'admin', 'api', 'www', 'support', 'about', 'login',
  'register', 'settings', 'me', 'profile', 'null', 'undefined',
])

/** Coerce an arbitrary string into a valid username candidate, or '' if impossible. */
function toCandidate(raw: string): string {
  let v = raw
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '') // drop disallowed chars
    .replace(/[._]{2,}/g, '.') // collapse consecutive separators
    .replace(/^[._]+|[._]+$/g, '') // strip leading/trailing separators
  if (v.length > 30) {
    v = v.slice(0, 30).replace(/[._]+$/g, '')
  }
  if (v.length < 3 || RESERVED.has(v)) return ''
  return v
}

export async function up(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('username', 30).nullable()
  })

  const users = await knex<{ id: string; university_id: string; email: string }>('users').select(
    'id',
    'university_id',
    'email',
  )

  // Track taken handles per university so dedup respects the tenant scope.
  const takenByUni = new Map<string, Set<string>>()
  const taken = (uni: string) => {
    let set = takenByUni.get(uni)
    if (!set) {
      set = new Set<string>()
      takenByUni.set(uni, set)
    }
    return set
  }

  for (const user of users) {
    const set = taken(user.university_id)
    const base = toCandidate(user.email.split('@')[0] ?? '') || `user_${user.id.slice(0, 8)}`

    let candidate = base
    let n = 1
    while (set.has(candidate)) {
      const suffix = String(n++)
      const room = 30 - suffix.length
      candidate = `${base.slice(0, room).replace(/[._]+$/g, '')}${suffix}`
    }
    set.add(candidate)

    await knex('users').where({ id: user.id }).update({ username: candidate })
  }

  // Case-insensitive uniqueness, scoped per tenant. Doubles as the lookup index.
  await knex.raw(
    'CREATE UNIQUE INDEX idx_users_username_per_uni ON users (university_id, lower(username))',
  )

  await knex.raw('ALTER TABLE users ALTER COLUMN username SET NOT NULL')
}

export async function down(knex: Knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_users_username_per_uni')
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('username')
  })
}
