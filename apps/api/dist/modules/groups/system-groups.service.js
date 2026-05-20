"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemGroupsService = exports.SystemGroupsService = void 0;
const db_1 = require("../../config/db");
const logger_1 = require("../../utils/logger");
const ADMIN_GROUP_NAME = 'All admins';
const ADMIN_GROUP_DESCRIPTION = 'Official auto-managed group for all administrators.';
class SystemGroupsService {
    async ensureSystemGroupsForUniversity(universityId, trx) {
        const executor = trx ?? db_1.db;
        const facultyDepts = (await executor('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where({ 'users.university_id': universityId, 'users.role': 'faculty' })
            .whereNotNull('profiles.department')
            .select('profiles.department')
            .groupBy('profiles.department'));
        await this.findOrCreateGroup(universityId, { role: 'admin' }, executor);
        for (const { department } of facultyDepts) {
            const trimmed = department.trim();
            if (!trimmed)
                continue;
            await this.findOrCreateGroup(universityId, { role: 'faculty', department: trimmed }, executor);
        }
    }
    async addUserToSystemGroups(userId, universityId, role, department) {
        if (role === 'admin') {
            const groupId = await this.findOrCreateGroup(universityId, { role: 'admin' }, db_1.db, userId);
            await this.attachMember(groupId, userId);
            return;
        }
        if (role === 'faculty' && department && department.trim()) {
            const groupId = await this.findOrCreateGroup(universityId, { role: 'faculty', department: department.trim() }, db_1.db, userId);
            await this.attachMember(groupId, userId);
            return;
        }
    }
    async removeUserFromSystemGroups(userId, universityId, role, department) {
        if (role === 'admin') {
            const group = await this.findGroup(universityId, { role: 'admin' });
            if (group)
                await this.detachMember(group.id, userId);
            return;
        }
        if (role === 'faculty' && department && department.trim()) {
            const group = await this.findGroup(universityId, { role: 'faculty', department: department.trim() });
            if (group)
                await this.detachMember(group.id, userId);
        }
    }
    async syncUserMembership(userId, universityId, previous, next) {
        if (previous.role === next.role && (previous.department ?? null) === (next.department ?? null)) {
            return;
        }
        try {
            await this.removeUserFromSystemGroups(userId, universityId, previous.role, previous.department);
            await this.addUserToSystemGroups(userId, universityId, next.role, next.department);
        }
        catch (error) {
            logger_1.logger.warn('System-groups sync failed', { error, userId, universityId });
        }
    }
    async findOrCreateGroup(universityId, kind, executor = db_1.db, creatorFallback) {
        const existing = await this.findGroup(universityId, kind, executor);
        if (existing)
            return existing.id;
        const createdBy = creatorFallback ?? (await this.firstUserOf(universityId, kind, executor));
        if (!createdBy) {
            // Without any matching user, we can't satisfy created_by NOT NULL. Defer creation.
            throw new Error('SYSTEM_GROUP_NO_CREATOR');
        }
        const [row] = await executor('groups')
            .insert({
            university_id: universityId,
            created_by: createdBy,
            name: kind.role === 'admin' ? ADMIN_GROUP_NAME : kind.department,
            description: kind.role === 'admin'
                ? ADMIN_GROUP_DESCRIPTION
                : `Official auto-managed group for ${kind.department} faculty.`,
            type: kind.role === 'admin' ? 'other' : 'department',
            is_private: true,
            is_system: true,
            allowed_role: kind.role,
            department: kind.role === 'admin' ? null : kind.department,
            member_count: 0,
        })
            .returning('id');
        return row.id;
    }
    async findGroup(universityId, kind, executor = db_1.db) {
        const query = executor('groups')
            .where({ university_id: universityId, is_system: true, allowed_role: kind.role })
            .select('id');
        if (kind.role === 'faculty') {
            query.andWhere({ department: kind.department });
        }
        else {
            query.whereNull('department');
        }
        return query.first();
    }
    async firstUserOf(universityId, kind, executor = db_1.db) {
        if (kind.role === 'admin') {
            const row = await executor('users')
                .where({ university_id: universityId, role: 'admin' })
                .select('id')
                .orderBy('created_at', 'asc')
                .first();
            return row?.id;
        }
        const row = await executor('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where({
            'users.university_id': universityId,
            'users.role': 'faculty',
            'profiles.department': kind.department,
        })
            .select('users.id')
            .orderBy('users.created_at', 'asc')
            .first();
        return row?.id;
    }
    async attachMember(groupId, userId) {
        await db_1.db.transaction(async (trx) => {
            const inserted = await trx('group_members')
                .insert({ group_id: groupId, user_id: userId, role: 'member' })
                .onConflict(['group_id', 'user_id'])
                .ignore()
                .returning('group_id');
            if (inserted.length > 0) {
                await trx('groups').where({ id: groupId }).increment('member_count', 1);
            }
        });
    }
    async detachMember(groupId, userId) {
        await db_1.db.transaction(async (trx) => {
            const deleted = await trx('group_members').where({ group_id: groupId, user_id: userId }).delete();
            if (deleted > 0) {
                await trx('groups').where({ id: groupId }).where('member_count', '>', 0).decrement('member_count', 1);
            }
        });
    }
}
exports.SystemGroupsService = SystemGroupsService;
exports.systemGroupsService = new SystemGroupsService();
