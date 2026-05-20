"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.alterTable('profiles', (table) => {
        table.boolean('is_open_to_mentorship').notNullable().defaultTo(false);
        table.integer('mentorship_points').notNullable().defaultTo(0);
    });
}
async function down(knex) {
    await knex.schema.alterTable('profiles', (table) => {
        table.dropColumn('is_open_to_mentorship');
        table.dropColumn('mentorship_points');
    });
}
