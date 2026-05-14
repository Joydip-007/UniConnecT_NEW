"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsService = exports.GroupsService = void 0;
const db_1 = require("../../config/db");
const service_1 = require("../feed/service");
const errors_1 = require("../../utils/errors");
class GroupsService {
    async listGroups(context, query) {
        const countQuery = visibleGroupsBaseQuery(db_1.db, context);
        applyGroupFilters(countQuery, query);
        const [{ count }] = await countQuery.count({ count: '*' });
        const total = Number(count);
        const rows = (await groupSelectQuery(db_1.db, context.userId)
            .where('groups.university_id', context.universityId)
            .andWhere((builder) => {
            builder.where('groups.is_private', false).orWhereNotNull('current_member.user_id');
        })
            .modify((builder) => applyGroupFilters(builder, query))
            .orderBy('groups.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit));
        return { items: rows.map(toGroup), total, page: query.page, limit: query.limit };
    }
    async createGroup(context, input) {
        const groupId = await db_1.db.transaction(async (trx) => {
            const [group] = await trx('groups')
                .insert({
                university_id: context.universityId,
                created_by: context.userId,
                name: input.name,
                description: input.description,
                type: input.type,
                avatar_url: input.avatar_url ?? null,
                cover_url: input.cover_url ?? null,
                is_private: input.is_private,
                member_count: 1,
            })
                .returning('id');
            if (!group)
                throw (0, errors_1.badRequest)('Group could not be created', 'GROUP_CREATE_FAILED');
            await trx('group_members').insert({
                group_id: group.id,
                user_id: context.userId,
                role: 'owner',
            });
            return group.id;
        });
        return this.getGroup(context, groupId);
    }
    async getGroup(context, groupId) {
        const row = await groupSelectQuery(db_1.db, context.userId)
            .where({ 'groups.id': groupId, 'groups.university_id': context.universityId })
            .first();
        if (!row)
            throw (0, errors_1.notFound)('Group not found', 'GROUP_NOT_FOUND');
        assertCanViewGroup(row);
        return toGroup(row);
    }
    async updateGroup(context, groupId, input) {
        const group = await assertGroupAccess(context, groupId);
        assertCanAdminGroup(group.user_role);
        await (0, db_1.db)('groups')
            .where({ id: groupId, university_id: context.universityId })
            .update({
            ...pickDefined({
                name: input.name,
                description: input.description,
                type: input.type,
                avatar_url: input.avatar_url,
                cover_url: input.cover_url,
                is_private: input.is_private,
            }),
        });
        return this.getGroup(context, groupId);
    }
    async deleteGroup(context, groupId) {
        const group = await assertGroupAccess(context, groupId);
        if (group.user_role !== 'owner') {
            throw (0, errors_1.forbidden)('Only the group owner can delete this group', 'GROUP_OWNER_REQUIRED');
        }
        await (0, db_1.db)('groups').where({ id: groupId, university_id: context.universityId }).delete();
        return { deleted: true };
    }
    async joinGroup(context, groupId) {
        await assertGroupExists(groupId, context.universityId);
        try {
            await db_1.db.transaction(async (trx) => {
                await trx('group_members').insert({
                    group_id: groupId,
                    user_id: context.userId,
                    role: 'member',
                });
                await trx('groups').where({ id: groupId, university_id: context.universityId }).increment('member_count', 1);
            });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw (0, errors_1.conflict)('Already a group member', 'ALREADY_GROUP_MEMBER');
            }
            throw error;
        }
        return this.getGroup(context, groupId);
    }
    async leaveGroup(context, groupId) {
        const group = await assertGroupAccess(context, groupId);
        if (!group.user_role)
            throw (0, errors_1.notFound)('Group membership not found', 'GROUP_MEMBERSHIP_NOT_FOUND');
        if (group.user_role === 'owner') {
            const ownerCount = await countOwners(groupId);
            if (ownerCount <= 1) {
                throw (0, errors_1.badRequest)('You must transfer ownership before leaving this group', 'GROUP_TRANSFER_OWNER_REQUIRED');
            }
        }
        await db_1.db.transaction(async (trx) => {
            const deleted = await trx('group_members').where({ group_id: groupId, user_id: context.userId }).delete();
            if (deleted > 0) {
                await trx('groups')
                    .where({ id: groupId, university_id: context.universityId })
                    .where('member_count', '>', 0)
                    .decrement('member_count', 1);
            }
        });
        return { left: true };
    }
    async listMembers(context, groupId, query) {
        await assertMemberAccess(context, groupId);
        const [{ count }] = await (0, db_1.db)('group_members').where({ group_id: groupId }).count({ count: '*' });
        const total = Number(count);
        const rows = (await memberSelectQuery(db_1.db)
            .where('group_members.group_id', groupId)
            .orderByRaw("CASE group_members.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END")
            .orderBy('profiles.full_name', 'asc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit));
        return { items: rows.map(toMember), total, page: query.page, limit: query.limit };
    }
    async updateMember(context, groupId, targetUserId, role) {
        const group = await assertGroupAccess(context, groupId);
        assertCanAdminGroup(group.user_role);
        const target = await getMembership(groupId, targetUserId);
        if (!target)
            throw (0, errors_1.notFound)('Group member not found', 'GROUP_MEMBER_NOT_FOUND');
        if (role === 'owner') {
            await this.transferOwnership(context, groupId, targetUserId, group.user_role, target.role);
            return this.getMember(groupId, targetUserId);
        }
        if (target.role === 'owner') {
            throw (0, errors_1.badRequest)('Use ownership transfer before changing the owner role', 'GROUP_OWNER_TRANSFER_REQUIRED');
        }
        assertCanAssignRole(group.user_role, target.role, role);
        await (0, db_1.db)('group_members').where({ group_id: groupId, user_id: targetUserId }).update({ role });
        return this.getMember(groupId, targetUserId);
    }
    async removeMember(context, groupId, targetUserId) {
        const group = await assertGroupAccess(context, groupId);
        assertCanAdminGroup(group.user_role);
        const target = await getMembership(groupId, targetUserId);
        if (!target)
            throw (0, errors_1.notFound)('Group member not found', 'GROUP_MEMBER_NOT_FOUND');
        if (target.role === 'owner')
            throw (0, errors_1.badRequest)('Cannot remove the group owner', 'GROUP_OWNER_REMOVE_FORBIDDEN');
        assertCanRemoveRole(group.user_role, target.role);
        await db_1.db.transaction(async (trx) => {
            const deleted = await trx('group_members').where({ group_id: groupId, user_id: targetUserId }).delete();
            if (deleted > 0) {
                await trx('groups')
                    .where({ id: groupId, university_id: context.universityId })
                    .where('member_count', '>', 0)
                    .decrement('member_count', 1);
            }
        });
        return { removed: true };
    }
    async listGroupPosts(context, groupId, query) {
        const group = await assertGroupAccess(context, groupId);
        if (group.is_private && !group.user_role) {
            throw (0, errors_1.notFound)('Group not found', 'GROUP_NOT_FOUND');
        }
        return service_1.feedService.listGroupPosts(context.universityId, context.userId, groupId, query);
    }
    async listMyGroups(context, query) {
        const [{ count }] = await (0, db_1.db)('group_members')
            .join('groups', 'groups.id', 'group_members.group_id')
            .where({ 'group_members.user_id': context.userId, 'groups.university_id': context.universityId })
            .count({ count: '*' });
        const total = Number(count);
        const rows = (await groupSelectQuery(db_1.db, context.userId)
            .join('group_members as my_groups_filter', 'my_groups_filter.group_id', 'groups.id')
            .where({
            'my_groups_filter.user_id': context.userId,
            'groups.university_id': context.universityId,
        })
            .orderBy('my_groups_filter.joined_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit));
        return { items: rows.map(toGroup), total, page: query.page, limit: query.limit };
    }
    async transferOwnership(context, groupId, targetUserId, actorRole, targetRole) {
        if (actorRole !== 'owner') {
            throw (0, errors_1.forbidden)('Only the group owner can transfer ownership', 'GROUP_OWNER_REQUIRED');
        }
        if (targetUserId === context.userId) {
            throw (0, errors_1.badRequest)('You are already the group owner', 'GROUP_OWNER_ALREADY_ASSIGNED');
        }
        if (targetRole === 'owner') {
            throw (0, errors_1.badRequest)('User is already the group owner', 'GROUP_OWNER_ALREADY_ASSIGNED');
        }
        await db_1.db.transaction(async (trx) => {
            await trx('group_members').where({ group_id: groupId, user_id: context.userId }).update({ role: 'admin' });
            await trx('group_members').where({ group_id: groupId, user_id: targetUserId }).update({ role: 'owner' });
        });
    }
    async getMember(groupId, userId) {
        const row = await memberSelectQuery(db_1.db)
            .where({ 'group_members.group_id': groupId, 'group_members.user_id': userId })
            .first();
        if (!row)
            throw (0, errors_1.notFound)('Group member not found', 'GROUP_MEMBER_NOT_FOUND');
        return toMember(row);
    }
}
exports.GroupsService = GroupsService;
exports.groupsService = new GroupsService();
function visibleGroupsBaseQuery(knex, context) {
    return knex('groups')
        .leftJoin('group_members as current_member', function joinCurrentMember() {
        this.on('current_member.group_id', '=', 'groups.id').andOn('current_member.user_id', '=', knex.raw('?', [context.userId]));
    })
        .where('groups.university_id', context.universityId)
        .andWhere((builder) => {
        builder.where('groups.is_private', false).orWhereNotNull('current_member.user_id');
    });
}
function applyGroupFilters(query, filters) {
    if (filters.type)
        query.andWhere('groups.type', filters.type);
    if (filters.search) {
        query.andWhere((builder) => {
            builder.whereILike('groups.name', `%${filters.search}%`).orWhereILike('groups.description', `%${filters.search}%`);
        });
    }
}
function groupSelectQuery(knex, userId) {
    return knex('groups')
        .leftJoin('group_members as current_member', function joinCurrentMember() {
        this.on('current_member.group_id', '=', 'groups.id').andOn('current_member.user_id', '=', knex.raw('?', [userId]));
    })
        .select('groups.id', 'groups.university_id', 'groups.created_by', 'groups.name', 'groups.description', 'groups.type', 'groups.avatar_url', 'groups.cover_url', 'groups.is_private', 'groups.member_count', 'groups.created_at', 'current_member.role as user_role');
}
function memberSelectQuery(knex) {
    return knex('group_members')
        .join('users', 'users.id', 'group_members.user_id')
        .join('profiles', 'profiles.user_id', 'users.id')
        .select('group_members.user_id', 'group_members.role', 'group_members.joined_at', 'users.email', 'users.role as user_role', 'profiles.full_name', 'profiles.avatar_url', 'profiles.headline', 'profiles.department', 'profiles.batch_year');
}
async function assertGroupExists(groupId, universityId) {
    const group = await (0, db_1.db)('groups').where({ id: groupId, university_id: universityId }).first();
    if (!group)
        throw (0, errors_1.notFound)('Group not found', 'GROUP_NOT_FOUND');
}
async function assertGroupAccess(context, groupId) {
    const group = await (0, db_1.db)('groups')
        .leftJoin('group_members as current_member', function joinCurrentMember() {
        this.on('current_member.group_id', '=', 'groups.id').andOn('current_member.user_id', '=', db_1.db.raw('?', [context.userId]));
    })
        .select('groups.id', 'groups.university_id', 'groups.created_by', 'groups.is_private', 'current_member.role as user_role')
        .where({ 'groups.id': groupId, 'groups.university_id': context.universityId })
        .first();
    if (!group)
        throw (0, errors_1.notFound)('Group not found', 'GROUP_NOT_FOUND');
    return group;
}
async function assertMemberAccess(context, groupId) {
    const group = await assertGroupAccess(context, groupId);
    if (!group.user_role)
        throw (0, errors_1.forbidden)('You must be a group member', 'GROUP_MEMBER_REQUIRED');
    return group;
}
async function getMembership(groupId, userId) {
    return (0, db_1.db)('group_members').select('role').where({ group_id: groupId, user_id: userId }).first();
}
async function countOwners(groupId) {
    const [{ count }] = await (0, db_1.db)('group_members')
        .where({ group_id: groupId, role: 'owner' })
        .count({ count: '*' });
    return Number(count);
}
function assertCanViewGroup(group) {
    if (!group.is_private || group.user_role)
        return;
    throw (0, errors_1.notFound)('Group not found', 'GROUP_NOT_FOUND');
}
function assertCanAdminGroup(role) {
    if (role === 'owner' || role === 'admin')
        return;
    throw (0, errors_1.forbidden)('You do not have permission to manage this group', 'GROUP_ADMIN_REQUIRED');
}
function assertCanAssignRole(actorRole, targetRole, nextRole) {
    if (actorRole === 'owner')
        return;
    if (actorRole === 'admin' && isBelowAdmin(targetRole) && isBelowAdmin(nextRole))
        return;
    throw (0, errors_1.forbidden)('You do not have permission to assign this role', 'GROUP_ROLE_FORBIDDEN');
}
function assertCanRemoveRole(actorRole, targetRole) {
    if (actorRole === 'owner')
        return;
    if (actorRole === 'admin' && isBelowAdmin(targetRole))
        return;
    throw (0, errors_1.forbidden)('You do not have permission to remove this member', 'GROUP_ROLE_FORBIDDEN');
}
function isBelowAdmin(role) {
    return role === 'moderator' || role === 'member';
}
function toGroup(row) {
    return {
        id: row.id,
        universityId: row.university_id,
        createdBy: row.created_by,
        name: row.name,
        description: row.description,
        type: row.type,
        avatarUrl: row.avatar_url,
        coverUrl: row.cover_url,
        isPrivate: row.is_private,
        memberCount: row.member_count,
        createdAt: row.created_at,
        userRole: row.user_role,
        isMember: Boolean(row.user_role),
    };
}
function toMember(row) {
    return {
        id: row.user_id,
        userId: row.user_id,
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
        headline: row.headline,
        department: row.department,
        batchYear: row.batch_year,
        role: row.role,
        joinedAt: row.joined_at,
        user: {
            id: row.user_id,
            email: row.email,
            role: row.user_role,
            fullName: row.full_name,
            avatarUrl: row.avatar_url,
            headline: row.headline,
            department: row.department,
            batchYear: row.batch_year,
        },
    };
}
function pickDefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
function isUniqueViolation(error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
