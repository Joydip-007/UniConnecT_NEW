"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('saved_posts', (table) => {
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.primary(['user_id', 'post_id']);
    });
    await knex.schema.alterTable('saved_posts', (table) => {
        table.index(['post_id'], 'idx_saved_posts_post');
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('saved_posts');
}
