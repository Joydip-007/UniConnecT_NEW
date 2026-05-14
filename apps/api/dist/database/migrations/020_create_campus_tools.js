"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('lost_and_found', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE');
        table.uuid('posted_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('type', 10).notNullable();
        table.string('item_name', 255).notNullable();
        table.text('description').notNullable();
        table.specificType('images', 'text[]');
        table.string('location_detail', 255).notNullable();
        table.string('contact_info', 255).notNullable();
        table.boolean('is_resolved').defaultTo(false);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
    await knex.raw("ALTER TABLE lost_and_found ADD CONSTRAINT lost_and_found_type_check CHECK (type IN ('lost', 'found'))");
    await knex.schema.createTable('shuttle_routes', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE');
        table.string('name', 100).notNullable();
        table.string('color', 7).notNullable();
        table.jsonb('stops').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
        table.jsonb('schedule').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
    await knex.schema.createTable('shuttle_locations', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('route_id').notNullable().references('id').inTable('shuttle_routes').onDelete('CASCADE');
        table.uuid('driver_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.double('lat').notNullable();
        table.double('lng').notNullable();
        table.decimal('speed_kmh', 5, 2);
        table.decimal('heading_deg', 5, 2);
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
    await knex.schema.createTable('courses', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE');
        table.string('code', 50).notNullable();
        table.string('title', 255).notNullable();
        table.string('section', 50);
        table.string('term', 100);
        table.text('lms_url');
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.unique(['university_id', 'code', 'section', 'term'], 'uq_courses_university_code_section_term');
    });
    await knex.schema.createTable('user_courses', (table) => {
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('course_id').notNullable().references('id').inTable('courses').onDelete('CASCADE');
        table.string('status', 30).defaultTo('enrolled');
        table.string('grade', 20);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.primary(['user_id', 'course_id']);
    });
    await knex.schema.alterTable('lost_and_found', (table) => {
        table.index(['university_id', 'is_resolved'], 'idx_lost_found_university_resolved');
        table.index(['posted_by'], 'idx_lost_found_posted_by');
    });
    await knex.schema.alterTable('shuttle_routes', (table) => {
        table.index(['university_id', 'is_active'], 'idx_shuttle_routes_university_active');
    });
    await knex.raw('CREATE INDEX idx_shuttle_locations_updated ON shuttle_locations (updated_at DESC)');
    await knex.schema.alterTable('courses', (table) => {
        table.index(['university_id', 'is_active'], 'idx_courses_university_active');
    });
    await knex.schema.alterTable('user_courses', (table) => {
        table.index(['course_id'], 'idx_user_courses_course');
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists('user_courses');
    await knex.schema.dropTableIfExists('courses');
    await knex.schema.dropTableIfExists('shuttle_locations');
    await knex.schema.dropTableIfExists('shuttle_routes');
    await knex.schema.dropTableIfExists('lost_and_found');
}
