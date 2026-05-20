"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    const universities = await knex('universities').select('id');
    for (const uni of universities) {
        await ensureAdminGroup(knex, uni.id);
        await ensureFacultyDeptGroups(knex, uni.id);
        await resyncMemberCounts(knex, uni.id);
    }
}
async function down(knex) {
    // Remove all system groups and their members (group_members cascade on groups delete)
    await knex('groups').where({ is_system: true }).delete();
}
async function ensureAdminGroup(knex, universityId) {
    const existing = await knex('groups')
        .where({ university_id: universityId, is_system: true, allowed_role: 'admin' })
        .select('id')
        .first();
    let groupId = existing?.id;
    if (!groupId) {
        const firstAdmin = await knex('users')
            .where({ university_id: universityId, role: 'admin' })
            .select('id')
            .orderBy('created_at', 'asc')
            .first();
        if (!firstAdmin)
            return; // no admin yet — group will be created lazily on first admin promotion
        const [row] = await knex('groups')
            .insert({
            university_id: universityId,
            created_by: firstAdmin.id,
            name: 'All admins',
            description: 'Official auto-managed group for all administrators.',
            type: 'other',
            is_private: true,
            is_system: true,
            allowed_role: 'admin',
            department: null,
            member_count: 0,
        })
            .returning('id');
        groupId = row.id;
    }
    // Sync membership: every admin in this university should be a member
    const admins = await knex('users')
        .where({ university_id: universityId, role: 'admin' })
        .select('id');
    for (const admin of admins) {
        await knex('group_members')
            .insert({ group_id: groupId, user_id: admin.id, role: 'member' })
            .onConflict(['group_id', 'user_id'])
            .ignore();
    }
}
async function ensureFacultyDeptGroups(knex, universityId) {
    const depts = (await knex('users')
        .join('profiles', 'profiles.user_id', 'users.id')
        .where({ 'users.university_id': universityId, 'users.role': 'faculty' })
        .whereNotNull('profiles.department')
        .select('users.university_id', 'profiles.department')
        .groupBy('users.university_id', 'profiles.department'));
    for (const { department } of depts) {
        const trimmed = department.trim();
        if (!trimmed)
            continue;
        let group = await knex('groups')
            .where({
            university_id: universityId,
            is_system: true,
            allowed_role: 'faculty',
            department: trimmed,
        })
            .select('id')
            .first();
        if (!group) {
            const firstFaculty = await knex('users')
                .join('profiles', 'profiles.user_id', 'users.id')
                .where({ 'users.university_id': universityId, 'users.role': 'faculty', 'profiles.department': trimmed })
                .select('users.id')
                .orderBy('users.created_at', 'asc')
                .first();
            if (!firstFaculty)
                continue;
            const [row] = await knex('groups')
                .insert({
                university_id: universityId,
                created_by: firstFaculty.id,
                name: trimmed,
                description: `Official auto-managed group for ${trimmed} faculty.`,
                type: 'department',
                is_private: true,
                is_system: true,
                allowed_role: 'faculty',
                department: trimmed,
                member_count: 0,
            })
                .returning('id');
            group = row;
        }
        const faculty = await knex('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where({ 'users.university_id': universityId, 'users.role': 'faculty', 'profiles.department': trimmed })
            .select('users.id');
        for (const user of faculty) {
            await knex('group_members')
                .insert({ group_id: group.id, user_id: user.id, role: 'member' })
                .onConflict(['group_id', 'user_id'])
                .ignore();
        }
    }
}
async function resyncMemberCounts(knex, universityId) {
    await knex.raw(`UPDATE groups g
       SET member_count = (
         SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id
       )
     WHERE g.university_id = ? AND g.is_system = true`, [universityId]);
}
