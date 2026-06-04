import type { Knex } from 'knex'

// Full-text search: stored, generated `search_vector` columns + GIN indexes.
// Names use the 'simple' dictionary (no stemming of proper nouns); prose uses
// 'english'. Weights: A = name/title, B = secondary, C = long-form body.
// The existing pg_trgm indexes (migration 024) stay for the fuzzy fallback.

const VECTORS: { table: string; expr: string }[] = [
  {
    table: 'profiles',
    expr: `
      setweight(to_tsvector('simple',  coalesce(full_name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(headline, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(department, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(array_to_string(skills, ' '), '')), 'B') ||
      setweight(to_tsvector('english', coalesce(bio, '')), 'C')
    `,
  },
  {
    table: 'posts',
    expr: `setweight(to_tsvector('english', coalesce(content, '')), 'A')`,
  },
  {
    table: 'jobs',
    expr: `
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(company, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(location, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'C')
    `,
  },
  {
    table: 'events',
    expr: `
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(location, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'C')
    `,
  },
  {
    table: 'groups',
    expr: `
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B')
    `,
  },
]

export async function up(knex: Knex) {
  for (const { table, expr } of VECTORS) {
    await knex.raw(
      `ALTER TABLE ${table}
       ADD COLUMN search_vector tsvector
       GENERATED ALWAYS AS (${expr.trim()}) STORED`,
    )
    await knex.raw(
      `CREATE INDEX idx_${table}_search_vector ON ${table} USING GIN (search_vector)`,
    )
  }
}

export async function down(knex: Knex) {
  for (const { table } of VECTORS) {
    await knex.raw(`DROP INDEX IF EXISTS idx_${table}_search_vector`)
    await knex.raw(`ALTER TABLE ${table} DROP COLUMN IF EXISTS search_vector`)
  }
}
