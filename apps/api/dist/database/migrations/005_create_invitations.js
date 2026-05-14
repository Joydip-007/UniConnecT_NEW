"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('invitations', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE');
        table.uuid('invited_by').references('id').inTable('users').onDelete('SET NULL');
        table.string('email', 255).notNullable();
        table.string('role', 20).notNullable();
        table.string('token', 64).notNullable().unique();
        table.boolean('is_used').defaultTo(false);
        table.timestamp('expires_at', { useTz: true }).notNullable();
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('invitations');
}
