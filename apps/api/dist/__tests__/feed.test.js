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
let facultyToken;
let createdPostId;
const createdPostIds = [];
(0, vitest_1.beforeAll)(async () => {
    const [st, sf] = await Promise.all([
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.student.email, setup_1.CREDENTIALS.student.password),
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.faculty.email, setup_1.CREDENTIALS.faculty.password),
    ]);
    studentToken = st.accessToken;
    facultyToken = sf.accessToken;
});
(0, vitest_1.afterAll)(async () => {
    if (createdPostIds.length > 0) {
        await (0, db_1.db)('posts').whereIn('id', createdPostIds).delete();
    }
});
function authHeader(token) {
    return { Authorization: `Bearer ${token}` };
}
(0, vitest_1.describe)('POST /api/v1/posts', () => {
    (0, vitest_1.it)('returns 201 when student creates a regular post', async () => {
        const res = await api
            .post('/api/v1/posts')
            .set(authHeader(studentToken))
            .send({ content: 'Hello from test student!', type: 'post' });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('id');
        (0, vitest_1.expect)(res.body.data.content).toBe('Hello from test student!');
        createdPostId = res.body.data.id;
        createdPostIds.push(createdPostId);
    });
    (0, vitest_1.it)('returns 403 when student tries to create an announcement', async () => {
        const res = await api
            .post('/api/v1/posts')
            .set(authHeader(studentToken))
            .send({ content: 'Announcement!', type: 'announcement' });
        (0, vitest_1.expect)(res.status).toBe(403);
        (0, vitest_1.expect)(res.body.code).toBe('ANNOUNCEMENT_FORBIDDEN');
    });
    (0, vitest_1.it)('returns 201 when faculty creates an announcement', async () => {
        const res = await api
            .post('/api/v1/posts')
            .set(authHeader(facultyToken))
            .send({ content: 'Official announcement!', type: 'announcement' });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data.type).toBe('announcement');
        createdPostIds.push(res.body.data.id);
    });
});
(0, vitest_1.describe)('GET /api/v1/posts', () => {
    (0, vitest_1.it)('returns 200 with paginated items array', async () => {
        const res = await api
            .get('/api/v1/posts')
            .set(authHeader(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('items');
        (0, vitest_1.expect)(Array.isArray(res.body.data.items)).toBe(true);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('total');
    });
});
(0, vitest_1.describe)('GET /api/v1/posts/:postId', () => {
    (0, vitest_1.it)('returns 200 with a single post', async () => {
        const res = await api
            .get(`/api/v1/posts/${createdPostId}`)
            .set(authHeader(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.id).toBe(createdPostId);
    });
});
(0, vitest_1.describe)('POST /api/v1/posts/:postId/reactions', () => {
    (0, vitest_1.it)('returns 200 on first reaction', async () => {
        const res = await api
            .post(`/api/v1/posts/${createdPostId}/reactions`)
            .set(authHeader(studentToken))
            .send({ reaction_type: 'like' });
        (0, vitest_1.expect)(res.status).toBe(200);
    });
    (0, vitest_1.it)('returns 200 on duplicate reaction (upsert, not 409)', async () => {
        const res = await api
            .post(`/api/v1/posts/${createdPostId}/reactions`)
            .set(authHeader(studentToken))
            .send({ reaction_type: 'like' });
        (0, vitest_1.expect)(res.status).toBe(200);
    });
});
(0, vitest_1.describe)('DELETE /api/v1/posts/:postId', () => {
    (0, vitest_1.it)('returns 403 when a different user tries to delete', async () => {
        // facultyToken is not the author of createdPostId
        const res = await api
            .delete(`/api/v1/posts/${createdPostId}`)
            .set(authHeader(facultyToken));
        (0, vitest_1.expect)(res.status).toBe(403);
    });
    (0, vitest_1.it)('returns 200 when author deletes their own post', async () => {
        // Create a dedicated post to delete
        const create = await api
            .post('/api/v1/posts')
            .set(authHeader(studentToken))
            .send({ content: 'Post to be deleted', type: 'post' });
        (0, vitest_1.expect)(create.status).toBe(201);
        const postId = create.body.data.id;
        const res = await api
            .delete(`/api/v1/posts/${postId}`)
            .set(authHeader(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
    });
});
(0, vitest_1.describe)('DELETE /api/v1/posts/:postId/comments/:commentId', () => {
    let postId;
    let commentId;
    (0, vitest_1.beforeAll)(async () => {
        const postRes = await api
            .post('/api/v1/posts')
            .set(authHeader(studentToken))
            .send({ content: 'Post for comment delete test', type: 'post' });
        postId = postRes.body.data.id;
        createdPostIds.push(postId);
        const commentRes = await api
            .post(`/api/v1/posts/${postId}/comments`)
            .set(authHeader(studentToken))
            .send({ content: 'Comment to delete' });
        commentId = commentRes.body.data.id;
    });
    (0, vitest_1.it)('returns 200 when the author deletes their comment', async () => {
        const res = await api
            .delete(`/api/v1/posts/${postId}/comments/${commentId}`)
            .set(authHeader(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.deleted).toBe(true);
    });
    (0, vitest_1.it)('returns 404 for an already-deleted comment', async () => {
        const res = await api
            .delete(`/api/v1/posts/${postId}/comments/${commentId}`)
            .set(authHeader(studentToken));
        (0, vitest_1.expect)(res.status).toBe(404);
    });
});
(0, vitest_1.describe)('POST /api/v1/posts/:postId/comments/:commentId/reactions', () => {
    let postId;
    let commentId;
    (0, vitest_1.beforeAll)(async () => {
        const postRes = await api
            .post('/api/v1/posts')
            .set(authHeader(studentToken))
            .send({ content: 'Post for comment reaction test', type: 'post' });
        postId = postRes.body.data.id;
        createdPostIds.push(postId);
        const commentRes = await api
            .post(`/api/v1/posts/${postId}/comments`)
            .set(authHeader(studentToken))
            .send({ content: 'Comment to react to' });
        commentId = commentRes.body.data.id;
    });
    (0, vitest_1.it)('returns 200 when adding a reaction', async () => {
        const res = await api
            .post(`/api/v1/posts/${postId}/comments/${commentId}/reactions`)
            .set(authHeader(studentToken))
            .send({ reaction_type: 'like' });
        (0, vitest_1.expect)(res.status).toBe(200);
    });
    (0, vitest_1.it)('returns 200 when removing a reaction', async () => {
        const res = await api
            .delete(`/api/v1/posts/${postId}/comments/${commentId}/reactions`)
            .set(authHeader(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
    });
});
