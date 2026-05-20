"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.alterTable('users', (table) => {
        table.index(['university_id'], 'idx_users_university');
        table.index(['role'], 'idx_users_role');
        table.index(['email'], 'idx_users_email');
    });
}
async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS idx_users_email');
    await knex.raw('DROP INDEX IF EXISTS idx_users_role');
    await knex.raw('DROP INDEX IF EXISTS idx_users_university');
}
