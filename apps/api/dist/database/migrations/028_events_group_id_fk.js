"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.raw(`ALTER TABLE events
       ADD CONSTRAINT events_group_id_fkey
       FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL`);
    await knex.raw('CREATE INDEX idx_events_group ON events (group_id) WHERE group_id IS NOT NULL');
}
async function down(knex) {
    await knex.raw('DROP INDEX IF EXISTS idx_events_group');
    await knex.raw('ALTER TABLE events DROP CONSTRAINT IF EXISTS events_group_id_fkey');
}
