"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('university_settings', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE');
        table.string('primary_color', 7).defaultTo('#1a56db');
        table.string('secondary_color', 7);
        table.boolean('allow_alumni_jobs').defaultTo(true);
        table.boolean('allow_public_feed').defaultTo(false);
        table.jsonb('features_enabled').defaultTo(knex.raw("'{}'::jsonb"));
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.unique(['university_id']);
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('university_settings');
}
