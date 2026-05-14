"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminService = exports.AdminService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_1 = require("../../config/db");
const errors_1 = require("../../utils/errors");
class AdminService {
    async getStats(universityId) {
        const [users, posts, jobs, events, groups, news, reports] = await Promise.all([
            countWhere('users', { university_id: universityId }),
            countWhere('posts', { university_id: universityId, is_deleted: false }),
            countWhere('jobs', { university_id: universityId }),
            countWhere('events', { university_id: universityId }),
            countWhere('groups', { university_id: universityId }),
            countWhere('news', { university_id: universityId }),
            countWhere('reports', {}),
        ]);
        const activeUsers = await countActive(universityId);
        return { users, posts, jobs, events, groups, news, reports, activeUsers };
    }
    async listUsers(universityId, query) {
        const baseQuery = (0, db_1.db)('users')
            .join('profiles', 'profiles.user_id', 'users.id')
            .where('users.university_id', universityId)
            .select('users.id', 'users.university_id', 'users.email', 'users.role', 'users.is_verified', 'users.is_active', 'users.last_active_at', 'users.created_at', 'profiles.full_name', 'profiles.avatar_url', 'profiles.department', 'profiles.batch_year');
        const [{ count }] = await (0, db_1.db)('users')
            .where({ university_id: universityId })
            .count({ count: '*' });
        const rows = await baseQuery
            .orderBy('users.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toAdminUser),
            total: Number(count),
            page: query.page,
            limit: query.limit,
        };
    }
    async updateUserRole(universityId, userId, input) {
        const updated = await (0, db_1.db)('users')
            .where({ id: userId, university_id: universityId })
            .update({ role: input.role });
        if (updated === 0)
            throw (0, errors_1.notFound)('User not found');
        return { userId, role: input.role };
    }
    async updateUserStatus(universityId, userId, input) {
        const updated = await (0, db_1.db)('users')
            .where({ id: userId, university_id: universityId })
            .update({ is_active: input.is_active });
        if (updated === 0)
            throw (0, errors_1.notFound)('User not found');
        return { userId, isActive: input.is_active };
    }
    async listReports(universityId, query) {
        const subQuery = (0, db_1.db)('users')
            .where('university_id', universityId)
            .select('id');
        const baseQuery = (0, db_1.db)('reports')
            .join('profiles as reporter_profile', 'reporter_profile.user_id', 'reports.reporter_id')
            .whereIn('reports.reporter_id', subQuery)
            .select('reports.id', 'reports.reporter_id', 'reports.target_id', 'reports.target_type', 'reports.reason', 'reports.description', 'reports.status', 'reports.resolved_by', 'reports.created_at', 'reports.resolved_at', 'reporter_profile.full_name as reporter_full_name');
        const [{ count }] = await (0, db_1.db)('reports')
            .whereIn('reporter_id', subQuery)
            .count({ count: '*' });
        const rows = await baseQuery
            .orderBy('reports.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toReport),
            total: Number(count),
            page: query.page,
            limit: query.limit,
        };
    }
    async resolveReport(resolvedById, reportId, input) {
        const updated = await (0, db_1.db)('reports')
            .where({ id: reportId })
            .update({
            status: input.status,
            resolved_by: resolvedById,
            resolved_at: db_1.db.fn.now(),
        });
        if (updated === 0)
            throw (0, errors_1.notFound)('Report not found');
        return { reportId, status: input.status };
    }
    async createInvitation(universityId, invitedById, input) {
        const token = node_crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + input.expires_in_days);
        const [row] = await (0, db_1.db)('invitations')
            .insert({
            university_id: universityId,
            invited_by: invitedById,
            email: input.email,
            role: input.role,
            token,
            expires_at: expiresAt,
        })
            .returning('*');
        return toInvitation(row);
    }
    async listInvitations(universityId, query) {
        const [{ count }] = await (0, db_1.db)('invitations')
            .where({ university_id: universityId })
            .count({ count: '*' });
        const rows = await (0, db_1.db)('invitations')
            .where({ university_id: universityId })
            .select('*')
            .orderBy('created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit);
        return {
            items: rows.map(toInvitation),
            total: Number(count),
            page: query.page,
            limit: query.limit,
        };
    }
    async deleteInvitation(universityId, invitationId) {
        const deleted = await (0, db_1.db)('invitations')
            .where({ id: invitationId, university_id: universityId })
            .delete();
        if (deleted === 0)
            throw (0, errors_1.notFound)('Invitation not found');
        return { deleted: true };
    }
}
exports.AdminService = AdminService;
exports.adminService = new AdminService();
async function countWhere(table, where) {
    const [{ count }] = await (0, db_1.db)(table).where(where).count({ count: '*' });
    return Number(count);
}
async function countActive(universityId) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [{ count }] = await (0, db_1.db)('users')
        .where('university_id', universityId)
        .andWhere('last_active_at', '>=', since)
        .count({ count: '*' });
    return Number(count);
}
function toAdminUser(row) {
    return {
        id: row.id,
        email: row.email,
        role: row.role,
        isVerified: row.is_verified,
        isActive: row.is_active,
        lastActiveAt: row.last_active_at,
        createdAt: row.created_at,
        profile: {
            fullName: row.full_name,
            avatarUrl: row.avatar_url,
            department: row.department,
            batchYear: row.batch_year,
        },
    };
}
function toReport(row) {
    return {
        id: row.id,
        reporterId: row.reporter_id,
        reporterName: row.reporter_full_name,
        targetId: row.target_id,
        targetType: row.target_type,
        reason: row.reason,
        description: row.description,
        status: row.status,
        resolvedBy: row.resolved_by,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
    };
}
function toInvitation(row) {
    return {
        id: row.id,
        email: row.email,
        role: row.role,
        token: row.token,
        isUsed: row.is_used,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
    };
}
