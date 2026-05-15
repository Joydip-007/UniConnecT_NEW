"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('tags', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE');
        table.string('name', 80).notNullable();
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.unique(['university_id', 'name'], 'uq_tags_university_name');
    });
    await knex.schema.createTable('post_tags', (table) => {
        table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE');
        table.uuid('tag_id').notNullable().references('id').inTable('tags').onDelete('CASCADE');
        table.primary(['post_id', 'tag_id']);
    });
    await knex.schema.alterTable('tags', (table) => {
        table.index(['university_id'], 'idx_tags_university');
    });
    await knex.schema.alterTable('post_tags', (table) => {
        table.index(['tag_id'], 'idx_post_tags_tag');
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('post_tags');
    await knex.schema.dropTableIfExists('tags');
}
