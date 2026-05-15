"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.alterTable('user_sessions', (table) => {
        table.text('refresh_token').alter();
    });
}
async function down(knex) {
    await knex.schema.alterTable('user_sessions', (table) => {
        table.string('refresh_token', 256).alter();
    });
}
