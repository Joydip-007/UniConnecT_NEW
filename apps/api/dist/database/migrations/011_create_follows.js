"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('follows', (table) => {
        table.uuid('follower_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('following_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.primary(['follower_id', 'following_id']);
    });
    await knex.schema.alterTable('follows', (table) => {
        table.index(['follower_id'], 'idx_follows_follower');
        table.index(['following_id'], 'idx_follows_following');
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('follows');
}
