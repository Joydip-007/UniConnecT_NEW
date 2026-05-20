"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    const exists = await knex.schema.hasTable('reports');
    if (!exists) {
        await knex.schema.createTable('reports', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
            table.uuid('reporter_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.uuid('target_id').notNullable();
            table.string('target_type', 50).notNullable();
            table.string('reason', 200).notNullable();
            table.text('description').nullable();
            table.string('status', 30).notNullable().defaultTo('pending');
            table.uuid('resolved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
            table.timestamp('resolved_at', { useTz: true }).nullable();
            table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        });
        await knex.raw("ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed'))");
    }
    // Add indexes if they don't already exist
    const hasReporterIdx = await knex.raw("SELECT 1 FROM pg_indexes WHERE tablename='reports' AND indexname='idx_reports_reporter'");
    if (!hasReporterIdx.rows.length) {
        await knex.raw("CREATE INDEX idx_reports_reporter ON reports (reporter_id)");
    }
    const hasTargetIdx = await knex.raw("SELECT 1 FROM pg_indexes WHERE tablename='reports' AND indexname='idx_reports_target'");
    if (!hasTargetIdx.rows.length) {
        await knex.raw("CREATE INDEX idx_reports_target ON reports (target_id, target_type)");
    }
    const hasStatusIdx = await knex.raw("SELECT 1 FROM pg_indexes WHERE tablename='reports' AND indexname='idx_reports_status_created'");
    if (!hasStatusIdx.rows.length) {
        await knex.raw("CREATE INDEX idx_reports_status_created ON reports (status, created_at)");
    }
}
async function down(knex) {
    await knex.schema.dropTableIfExists('reports');
}
