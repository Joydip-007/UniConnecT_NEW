"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.alterTable('users', (table) => {
        table.boolean('is_deleted').notNullable().defaultTo(false);
    });
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS users_is_deleted_idx ON users (is_deleted) WHERE is_deleted = false');
}
async function down(knex) {
    await knex.schema.raw('DROP INDEX IF EXISTS users_is_deleted_idx');
    await knex.schema.alterTable('users', (table) => {
        table.dropColumn('is_deleted');
    });
}
