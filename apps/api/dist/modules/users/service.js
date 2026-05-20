"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersService = exports.UsersService = void 0;
const db_1 = require("../../config/db");
const errors_1 = require("../../utils/errors");
const system_groups_service_1 = require("../groups/system-groups.service");
class UsersService {
    async getCurrentUser(userId, universityId) {
        const user = await getUserProfileQuery()
            .where({
            'users.id': userId,
            'users.university_id': universityId,
        })
            .first();
        if (!user)
            throw (0, errors_1.notFound)('User not found');
        return toUserProfile(user, { includePhone: true });
    }
    async updateCurrentUser(userId, universityId, input) {
        const existing = await (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where({ 'users.id': userId, 'users.university_id': universityId })
            .select('users.role', 'profiles.department')
            .first();
        if (!existing)
            throw (0, errors_1.notFound)('User not found');
        const update = { updated_at: db_1.db.fn.now() };
        if (input.fullName !== undefined)
            update.full_name = input.fullName;
        if (input.bio !== undefined)
            update.bio = input.bio;
        if (input.headline !== undefined)
            update.headline = input.headline;
        if (input.department !== undefined)
            update.department = input.department;
        if (input.batchYear !== undefined)
            update.batch_year = input.batchYear;
        if (input.linkedinUrl !== undefined)
            update.linkedin_url = input.linkedinUrl;
        if (input.phone !== undefined)
            update.phone = input.phone;
        if (input.skills !== undefined)
            update.skills = input.skills;
        if (input.avatarUrl !== undefined)
            update.avatar_url = input.avatarUrl;
        if (input.coverUrl !== undefined)
            update.cover_url = input.coverUrl;
        if (input.isOpenToWork !== undefined)
            update.is_open_to_work = input.isOpenToWork;
        if (input.isOpenToMentorship !== undefined)
            update.is_open_to_mentorship = input.isOpenToMentorship;
        await (0, db_1.db)('profiles').where({ user_id: userId }).update(update);
        if (input.department !== undefined && input.department !== existing.department) {
            await system_groups_service_1.systemGroupsService.syncUserMembership(userId, universityId, { role: existing.role, department: existing.department }, { role: existing.role, department: input.department });
        }
        return this.getCurrentUser(userId, universityId);
    }
    async updatePreferences(userId, universityId, input) {
        const update = {};
        if (input.themePreference !== undefined) {
            update.theme_preference = input.themePreference;
        }
        const affected = await (0, db_1.db)('users')
            .where({ id: userId, university_id: universityId })
            .update(update);
        if (affected === 0)
            throw (0, errors_1.notFound)('User not found');
        return this.getCurrentUser(userId, universityId);
    }
    async getPublicProfile(currentUserId, targetUserId, universityId) {
        const user = await getUserProfileQuery()
            .where({
            'users.id': targetUserId,
            'users.university_id': universityId,
        })
            .first();
        if (!user)
            throw (0, errors_1.notFound)('User not found');
        const [followers, following, posts, isFollowingRow] = await Promise.all([
            countFollows('following_id', targetUserId, universityId),
            countFollows('follower_id', targetUserId, universityId),
            (0, db_1.db)('posts').where({ author_id: targetUserId }).count({ count: '*' }).then(([r]) => Number(r.count)),
            currentUserId !== targetUserId
                ? (0, db_1.db)('follows').where({ follower_id: currentUserId, following_id: targetUserId }).first()
                : Promise.resolve(null),
        ]);
        return {
            ...toUserProfile(user, { includePhone: currentUserId === targetUserId }),
            stats: { followers, following, posts },
            isFollowing: !!isFollowingRow,
        };
    }
    async listUsers(universityId, query) {
        const baseQuery = getUserProfileQuery().where('users.university_id', universityId);
        applyUserFilters(baseQuery, query);
        const countQuery = (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where('users.university_id', universityId);
        applyUserFilters(countQuery, query);
        const [{ count }] = await countQuery.count({ count: '*' });
        const total = Number(count);
        const offset = (query.page - 1) * query.limit;
        const rows = await baseQuery
            .orderBy('profiles.full_name', 'asc')
            .limit(query.limit)
            .offset(offset);
        return {
            items: rows.map((row) => toUserProfile(row, { includePhone: false })),
            total,
            page: query.page,
            limit: query.limit,
        };
    }
    async followUser(currentUserId, targetUserId, universityId) {
        if (currentUserId === targetUserId) {
            throw (0, errors_1.badRequest)('You cannot follow yourself', 'SELF_FOLLOW_NOT_ALLOWED');
        }
        await assertUserInUniversity(targetUserId, universityId);
        try {
            await (0, db_1.db)('follows').insert({
                follower_id: currentUserId,
                following_id: targetUserId,
            });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw (0, errors_1.conflict)('Already following this user', 'ALREADY_FOLLOWING');
            }
            throw error;
        }
        return { following: true };
    }
    async unfollowUser(currentUserId, targetUserId, universityId) {
        await assertUserInUniversity(targetUserId, universityId);
        await (0, db_1.db)('follows').where({ follower_id: currentUserId, following_id: targetUserId }).delete();
        return { following: false };
    }
    async listFollowers(targetUserId, universityId, query) {
        await assertUserInUniversity(targetUserId, universityId);
        const baseQuery = getUserProfileQuery()
            .join('follows', 'follows.follower_id', 'users.id')
            .where({
            'follows.following_id': targetUserId,
            'users.university_id': universityId,
        });
        const total = await countFollows('following_id', targetUserId, universityId);
        const rows = await baseQuery
            .orderBy('follows.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map((row) => toUserProfile(row, { includePhone: false })),
            total,
            page: query.page,
            limit: query.limit,
        };
    }
    async listFollowing(targetUserId, universityId, query) {
        await assertUserInUniversity(targetUserId, universityId);
        const baseQuery = getUserProfileQuery()
            .join('follows', 'follows.following_id', 'users.id')
            .where({
            'follows.follower_id': targetUserId,
            'users.university_id': universityId,
        });
        const total = await countFollows('follower_id', targetUserId, universityId);
        const rows = await baseQuery
            .orderBy('follows.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map((row) => toUserProfile(row, { includePhone: false })),
            total,
            page: query.page,
            limit: query.limit,
        };
    }
    async getSuggestions(currentUserId, universityId) {
        const currentUser = await (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .select('profiles.department')
            .where({ 'users.id': currentUserId, 'users.university_id': universityId })
            .first();
        if (!currentUser)
            throw (0, errors_1.notFound)('User not found');
        const rows = await getUserProfileQuery()
            .where('users.university_id', universityId)
            .whereNot('users.id', currentUserId)
            .modify((builder) => {
            if (currentUser.department) {
                builder.where('profiles.department', currentUser.department);
            }
        })
            .whereNotExists(function excludeFollowed() {
            this.select(db_1.db.raw('1'))
                .from('follows')
                .whereRaw('follows.following_id = users.id')
                .andWhere('follows.follower_id', currentUserId);
        })
            .orderBy('profiles.full_name', 'asc')
            .limit(10);
        return rows.map((row) => toUserProfile(row, { includePhone: false }));
    }
    async getProgress(userId, universityId) {
        const row = await (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .select('users.is_verified', 'profiles.bio', 'profiles.headline', 'profiles.department', 'profiles.batch_year', 'profiles.avatar_url', 'profiles.skills', 'profiles.linkedin_url')
            .where({ 'users.id': userId, 'users.university_id': universityId })
            .first();
        if (!row)
            throw (0, errors_1.notFound)('User not found');
        const fields = [
            Boolean(row.bio),
            Boolean(row.headline),
            Boolean(row.department),
            Boolean(row.batch_year),
            Boolean(row.avatar_url),
            Array.isArray(row.skills) && row.skills.length >= 1,
            Boolean(row.linkedin_url),
        ];
        const profileScore = Math.round((fields.filter(Boolean).length / fields.length) * 100);
        const [postResult] = await (0, db_1.db)('posts')
            .where({ author_id: userId, university_id: universityId })
            .count({ count: '*' });
        const hasMadePost = Number(postResult.count) > 0;
        const [followerResult] = await (0, db_1.db)('follows')
            .join('users', 'users.id', 'follows.follower_id')
            .where({ 'follows.following_id': userId, 'users.university_id': universityId })
            .count({ count: '*' });
        const followerCount = Number(followerResult.count);
        return {
            profileScore,
            hasMadePost,
            followerCount,
            isVerified: row.is_verified,
        };
    }
}
exports.UsersService = UsersService;
exports.usersService = new UsersService();
function getUserProfileQuery() {
    return (0, db_1.db)('users')
        .join('profiles', 'profiles.user_id', 'users.id')
        .select('users.id', 'users.university_id', 'users.email', 'users.role', 'users.is_verified', 'users.is_active', 'users.last_active_at', 'users.created_at', 'users.theme_preference', 'profiles.full_name', 'profiles.avatar_url', 'profiles.cover_url', 'profiles.bio', 'profiles.department', 'profiles.batch_year', 'profiles.headline', 'profiles.linkedin_url', 'profiles.phone', 'profiles.skills', 'profiles.is_open_to_work', 'profiles.is_open_to_mentorship', 'profiles.mentorship_points');
}
function applyUserFilters(query, filters) {
    if (filters.role)
        query.where('users.role', filters.role);
    if (filters.department)
        query.where('profiles.department', filters.department);
    if (filters.batch_year)
        query.where('profiles.batch_year', filters.batch_year);
    if (filters.search)
        query.whereILike('profiles.full_name', `%${filters.search}%`);
}
async function assertUserInUniversity(userId, universityId) {
    const user = await (0, db_1.db)('users').where({ id: userId, university_id: universityId }).first();
    if (!user)
        throw (0, errors_1.notFound)('User not found');
}
async function countFollows(column, userId, universityId) {
    const [{ count }] = await (0, db_1.db)('follows')
        .join('users', `users.id`, `follows.${column === 'follower_id' ? 'following_id' : 'follower_id'}`)
        .where(`follows.${column}`, userId)
        .andWhere('users.university_id', universityId)
        .count({ count: '*' });
    return Number(count);
}
function toUserProfile(row, options) {
    return {
        id: row.id,
        email: row.email,
        role: row.role,
        universityId: row.university_id,
        isVerified: row.is_verified,
        isActive: row.is_active,
        lastActiveAt: row.last_active_at,
        createdAt: row.created_at,
        themePreference: row.theme_preference,
        profile: {
            fullName: row.full_name,
            avatarUrl: row.avatar_url,
            coverUrl: row.cover_url,
            bio: row.bio,
            department: row.department,
            batchYear: row.batch_year,
            headline: row.headline,
            linkedinUrl: row.linkedin_url,
            phone: options.includePhone ? row.phone : null,
            skills: row.skills ?? [],
            isOpenToWork: row.is_open_to_work,
            isOpenToMentorship: row.is_open_to_mentorship,
            mentorshipPoints: row.mentorship_points,
        },
    };
}
function isUniqueViolation(error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
