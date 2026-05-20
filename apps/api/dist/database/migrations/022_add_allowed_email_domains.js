"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.alterTable('universities', (table) => {
        table.specificType('allowed_email_domains', 'text[]').defaultTo(null);
    });
}
async function down(knex) {
    await knex.schema.alterTable('universities', (table) => {
        table.dropColumn('allowed_email_domains');
    });
}
