"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('comments', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE');
        table.uuid('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('parent_id').references('id').inTable('comments').onDelete('CASCADE');
        table.text('content').notNullable();
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
    await knex.schema.alterTable('comments', (table) => {
        table.index(['post_id'], 'idx_comments_post');
        table.index(['author_id'], 'idx_comments_author');
        table.index(['parent_id'], 'idx_comments_parent');
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('comments');
}
