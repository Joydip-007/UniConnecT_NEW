"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.alterTable('users', (table) => {
        table.text('theme_preference').notNullable().defaultTo('system');
    });
    await knex.raw("ALTER TABLE users ADD CONSTRAINT users_theme_preference_check CHECK (theme_preference IN ('light', 'dark', 'system'))");
}
async function down(knex) {
    await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_theme_preference_check');
    await knex.schema.alterTable('users', (table) => {
        table.dropColumn('theme_preference');
    });
}
