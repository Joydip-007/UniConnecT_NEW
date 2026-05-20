"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('mentor_redemptions', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table
            .uuid('university_id')
            .notNullable()
            .references('id')
            .inTable('universities')
            .onDelete('CASCADE');
        table
            .uuid('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table
            .uuid('gift_card_id')
            .notNullable()
            .references('id')
            .inTable('gift_cards')
            .onDelete('RESTRICT');
        table.integer('points_spent').notNullable();
        table.string('status', 20).notNullable().defaultTo('pending');
        table.text('code_text');
        table.text('admin_note');
        table
            .uuid('fulfilled_by')
            .references('id')
            .inTable('users')
            .onDelete('SET NULL');
        table.timestamp('requested_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('fulfilled_at', { useTz: true });
        table.index(['university_id', 'status', 'requested_at'], 'idx_redemptions_uni_status_req');
        table.index(['user_id', 'requested_at'], 'idx_redemptions_user_req');
    });
    await knex.raw(`
    ALTER TABLE mentor_redemptions
    ADD CONSTRAINT mentor_redemptions_status_check
    CHECK (status IN ('pending', 'fulfilled', 'rejected'))
  `);
}
async function down(knex) {
    await knex.schema.dropTableIfExists('mentor_redemptions');
}
