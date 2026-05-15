"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('posts', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE');
        table.uuid('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('type', 30).notNullable();
        table.text('content').notNullable();
        table.specificType('media_urls', 'text[]');
        table.uuid('group_id');
        table.boolean('is_pinned').defaultTo(false);
        table.integer('view_count').defaultTo(0);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
    await knex.raw("ALTER TABLE posts ADD CONSTRAINT posts_type_check CHECK (type IN ('post', 'announcement', 'lost_found', 'news', 'event_promo'))");
    await knex.schema.alterTable('posts', (table) => {
        table.index(['university_id'], 'idx_posts_university');
        table.index(['author_id'], 'idx_posts_author');
    });
    await knex.raw('CREATE INDEX idx_posts_created ON posts (university_id, created_at DESC)');
}
async function down(knex) {
    await knex.schema.dropTableIfExists('posts');
}
