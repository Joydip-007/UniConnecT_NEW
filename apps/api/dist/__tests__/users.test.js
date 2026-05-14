"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const setup_1 = require("./setup");
const db_1 = require("../config/db");
const api = (0, supertest_1.default)(setup_1.app);
let studentToken;
let alumniToken;
let studentId;
let alumniId;
(0, vitest_1.beforeAll)(async () => {
    const [st, al] = await Promise.all([
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.student.email, setup_1.CREDENTIALS.student.password),
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.alumni.email, setup_1.CREDENTIALS.alumni.password),
    ]);
    studentToken = st.accessToken;
    alumniToken = al.accessToken;
    // Resolve user IDs from /me
    const [stMe, alMe] = await Promise.all([
        api.get('/api/v1/users/me').set('Authorization', `Bearer ${studentToken}`),
        api.get('/api/v1/users/me').set('Authorization', `Bearer ${alumniToken}`),
    ]);
    studentId = stMe.body.data.id;
    alumniId = alMe.body.data.id;
});
function auth(token) {
    return { Authorization: `Bearer ${token}` };
}
(0, vitest_1.describe)('GET /api/v1/users/me', () => {
    (0, vitest_1.it)('returns 200 with the current user profile', async () => {
        const res = await api.get('/api/v1/users/me').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('id');
        (0, vitest_1.expect)(res.body.data.email).toBe(setup_1.CREDENTIALS.student.email);
    });
});
(0, vitest_1.describe)('PATCH /api/v1/users/me', () => {
    (0, vitest_1.it)('returns 200 with updated profile data', async () => {
        const res = await api
            .patch('/api/v1/users/me')
            .set(auth(studentToken))
            .send({ bio: 'Integration test bio', headline: 'Test Student' });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.profile.bio).toBe('Integration test bio');
    });
});
(0, vitest_1.describe)('POST /api/v1/users/:userId/follow', () => {
    (0, vitest_1.it)('returns 200 when student follows alumni', async () => {
        // Ensure not already following
        await (0, db_1.db)('follows').where({ follower_id: studentId, following_id: alumniId }).delete();
        const res = await api
            .post(`/api/v1/users/${alumniId}/follow`)
            .set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.following).toBe(true);
    });
    (0, vitest_1.it)('returns 400 when user tries to follow themselves', async () => {
        const res = await api
            .post(`/api/v1/users/${studentId}/follow`)
            .set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.code).toBe('SELF_FOLLOW_NOT_ALLOWED');
    });
});
(0, vitest_1.describe)('DELETE /api/v1/users/:userId/follow', () => {
    (0, vitest_1.it)('returns 200 when student unfollows alumni', async () => {
        // Ensure following first
        await (0, db_1.db)('follows')
            .insert({ follower_id: studentId, following_id: alumniId })
            .onConflict(['follower_id', 'following_id'])
            .ignore();
        const res = await api
            .delete(`/api/v1/users/${alumniId}/follow`)
            .set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.following).toBe(false);
    });
});
(0, vitest_1.describe)('GET /api/v1/users/suggestions', () => {
    (0, vitest_1.it)('returns 200 with an array of suggestions', async () => {
        const res = await api.get('/api/v1/users/suggestions').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
    });
});
