"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await knex.schema.createTable('universities', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('name', 255).notNullable();
        table.string('domain', 100).notNullable().unique();
        table.text('logo_url');
        table.string('country', 100).defaultTo('Bangladesh');
        table.string('plan', 50).defaultTo('starter');
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('universities');
}
