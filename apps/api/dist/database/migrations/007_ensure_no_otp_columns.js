"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.raw('ALTER TABLE users DROP COLUMN IF EXISTS otp_code');
    await knex.raw('ALTER TABLE users DROP COLUMN IF EXISTS otp_expires_at');
}
async function down(knex) {
    await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6)');
    await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ');
}
