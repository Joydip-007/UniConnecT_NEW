"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    // Drop constraint first to allow the update
    await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
    // Update data
    await knex('users').where({ role: 'staff' }).update({ role: 'faculty' });
    await knex('invitations').where({ role: 'staff' }).update({ role: 'faculty' });
    // Add new constraint with faculty instead of staff
    await knex.raw("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'alumni', 'faculty', 'admin'))");
}
async function down(knex) {
    await knex('invitations').where({ role: 'faculty' }).update({ role: 'staff' });
    await knex('users').where({ role: 'faculty' }).update({ role: 'staff' });
    await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
    await knex.raw("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'alumni', 'staff', 'admin'))");
}
