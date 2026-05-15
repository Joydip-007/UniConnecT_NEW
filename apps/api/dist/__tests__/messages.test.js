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
let convId;
const createdConvIds = [];
(0, vitest_1.beforeAll)(async () => {
    const [st, al] = await Promise.all([
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.student.email, setup_1.CREDENTIALS.student.password),
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.alumni.email, setup_1.CREDENTIALS.alumni.password),
    ]);
    studentToken = st.accessToken;
    alumniToken = al.accessToken;
    const [stMe, alMe] = await Promise.all([
        api.get('/api/v1/users/me').set('Authorization', `Bearer ${studentToken}`),
        api.get('/api/v1/users/me').set('Authorization', `Bearer ${alumniToken}`),
    ]);
    studentId = stMe.body.data.id;
    alumniId = alMe.body.data.id;
});
(0, vitest_1.afterAll)(async () => {
    if (createdConvIds.length > 0) {
        await (0, db_1.db)('messages').whereIn('conversation_id', createdConvIds).delete();
        await (0, db_1.db)('conversation_participants').whereIn('conversation_id', createdConvIds).delete();
        await (0, db_1.db)('conversations').whereIn('id', createdConvIds).delete();
    }
});
function auth(token) {
    return { Authorization: `Bearer ${token}` };
}
(0, vitest_1.describe)('POST /api/v1/conversations', () => {
    (0, vitest_1.it)('returns 201 when creating a new DM between student and alumni', async () => {
        // Clean up any pre-existing DM between the pair
        const existing = await (0, db_1.db)('conversations as c')
            .join('conversation_participants as p1', 'p1.conversation_id', 'c.id')
            .join('conversation_participants as p2', 'p2.conversation_id', 'c.id')
            .where({
            'c.is_group': false,
            'p1.user_id': studentId,
            'p2.user_id': alumniId,
        })
            .select('c.id');
        if (existing.length > 0) {
            const ids = existing.map((r) => r.id);
            await (0, db_1.db)('messages').whereIn('conversation_id', ids).delete();
            await (0, db_1.db)('conversation_participants').whereIn('conversation_id', ids).delete();
            await (0, db_1.db)('conversations').whereIn('id', ids).delete();
        }
        const res = await api
            .post('/api/v1/conversations')
            .set(auth(studentToken))
            .send({ participantId: alumniId, is_group: false });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('id');
        convId = res.body.data.id;
        createdConvIds.push(convId);
    });
    (0, vitest_1.it)('returns 200 with existing conversation on second POST with same pair', async () => {
        const res = await api
            .post('/api/v1/conversations')
            .set(auth(studentToken))
            .send({ participantId: alumniId, is_group: false });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.id).toBe(convId);
    });
});
(0, vitest_1.describe)('POST /api/v1/conversations/:convId/messages', () => {
    (0, vitest_1.it)('returns 201 when sending a message', async () => {
        const res = await api
            .post(`/api/v1/conversations/${convId}/messages`)
            .set(auth(studentToken))
            .send({ content: 'Hello alumni!' });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('id');
        (0, vitest_1.expect)(res.body.data.content).toBe('Hello alumni!');
    });
});
(0, vitest_1.describe)('GET /api/v1/conversations/:convId/messages', () => {
    (0, vitest_1.it)('returns 200 with paginated message list', async () => {
        const res = await api
            .get(`/api/v1/conversations/${convId}/messages`)
            .set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('items');
        (0, vitest_1.expect)(Array.isArray(res.body.data.items)).toBe(true);
    });
});
(0, vitest_1.describe)('POST /api/v1/conversations/:convId/read', () => {
    (0, vitest_1.it)('returns 200 when marking conversation as read', async () => {
        const res = await api
            .post(`/api/v1/conversations/${convId}/read`)
            .set(auth(alumniToken));
        (0, vitest_1.expect)(res.status).toBe(200);
    });
});
