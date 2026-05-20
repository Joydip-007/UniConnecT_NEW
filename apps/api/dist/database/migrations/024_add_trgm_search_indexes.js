"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON profiles USING GIN (full_name gin_trgm_ops)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON posts USING GIN (content gin_trgm_ops)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING GIN (title gin_trgm_ops)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm ON jobs USING GIN (company gin_trgm_ops)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING GIN (title gin_trgm_ops)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_groups_name_trgm ON groups USING GIN (name gin_trgm_ops)');
}
async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS idx_profiles_full_name_trgm');
    await knex.raw('DROP INDEX IF EXISTS idx_posts_content_trgm');
    await knex.raw('DROP INDEX IF EXISTS idx_jobs_title_trgm');
    await knex.raw('DROP INDEX IF EXISTS idx_jobs_company_trgm');
    await knex.raw('DROP INDEX IF EXISTS idx_events_title_trgm');
    await knex.raw('DROP INDEX IF EXISTS idx_groups_name_trgm');
}
