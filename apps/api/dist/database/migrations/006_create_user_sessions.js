"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('user_sessions', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('refresh_token', 256).notNullable().unique();
        table.jsonb('device_info');
        table.specificType('ip_address', 'inet');
        table.timestamp('expires_at', { useTz: true }).notNullable();
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('user_sessions');
}
