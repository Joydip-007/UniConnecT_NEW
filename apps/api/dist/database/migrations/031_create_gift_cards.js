"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('gift_cards', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('vendor', 100).notNullable();
        table.string('title', 160).notNullable();
        table.text('description');
        table.text('image_url');
        table.integer('value_usd_cents').notNullable();
        table.integer('threshold_points').notNullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.index(['is_active', 'threshold_points'], 'idx_gift_cards_active_threshold');
        table.unique(['title'], 'uq_gift_cards_title');
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('gift_cards');
}
