"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('groups', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE');
        table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('name', 255).notNullable();
        table.text('description').notNullable();
        table.string('type', 30).notNullable();
        table.text('avatar_url');
        table.text('cover_url');
        table.boolean('is_private').defaultTo(false);
        table.integer('member_count').defaultTo(0);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
    await knex.raw("ALTER TABLE groups ADD CONSTRAINT groups_type_check CHECK (type IN ('department', 'club', 'batch', 'research', 'interest', 'other'))");
    await knex.raw('ALTER TABLE groups ADD CONSTRAINT groups_member_count_check CHECK (member_count >= 0)');
    await knex.schema.createTable('group_members', (table) => {
        table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('role', 20).notNullable().defaultTo('member');
        table.timestamp('joined_at', { useTz: true }).defaultTo(knex.fn.now());
        table.primary(['group_id', 'user_id']);
    });
    await knex.raw("ALTER TABLE group_members ADD CONSTRAINT group_members_role_check CHECK (role IN ('owner', 'admin', 'moderator', 'member'))");
    await knex.schema.alterTable('groups', (table) => {
        table.index(['university_id'], 'idx_groups_university');
        table.index(['type'], 'idx_groups_type');
        table.index(['created_by'], 'idx_groups_created_by');
    });
    await knex.schema.alterTable('group_members', (table) => {
        table.index(['user_id'], 'idx_group_members_user');
        table.index(['role'], 'idx_group_members_role');
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('group_members');
    await knex.schema.dropTableIfExists('groups');
}
