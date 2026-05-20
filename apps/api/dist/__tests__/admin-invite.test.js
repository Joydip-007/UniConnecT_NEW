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
const UNI = { 'x-university-domain': setup_1.DOMAIN };
let adminToken;
let facultyToken;
(0, vitest_1.beforeAll)(async () => {
    const [admin, faculty] = await Promise.all([
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.admin.email, setup_1.CREDENTIALS.admin.password),
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.faculty.email, setup_1.CREDENTIALS.faculty.password),
    ]);
    adminToken = admin.accessToken;
    facultyToken = faculty.accessToken;
});
(0, vitest_1.afterAll)(async () => {
    await db_1.db.raw(`DELETE FROM invitations WHERE university_id = ? AND (email LIKE 'inv.test%' OR email LIKE 'bulk.test%')`, [setup_1.TEST_UNIVERSITY_ID]);
});
(0, vitest_1.describe)('POST /api/v1/admin/invitations', () => {
    (0, vitest_1.it)('returns 201 with invitation data including token', async () => {
        const email = `inv.test.${Date.now()}@uiu.ac.bd`;
        const res = await api
            .post('/api/v1/admin/invitations')
            .set(UNI)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email, role: 'student', expires_in_days: 7 });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data).toMatchObject({ email, role: 'student' });
        (0, vitest_1.expect)(res.body.data).toHaveProperty('id');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('token');
    });
    (0, vitest_1.it)('returns 401 without auth token', async () => {
        const res = await api
            .post('/api/v1/admin/invitations')
            .set(UNI)
            .send({ email: 'noauth@uiu.ac.bd', role: 'student', expires_in_days: 7 });
        (0, vitest_1.expect)(res.status).toBe(401);
    });
});
(0, vitest_1.describe)('POST /api/v1/admin/invitations/bulk', () => {
    (0, vitest_1.it)('returns 201 with created count and emails list', async () => {
        const ts = Date.now();
        const emails = [`bulk.test.a.${ts}@uiu.ac.bd`, `bulk.test.b.${ts}@uiu.ac.bd`];
        const res = await api
            .post('/api/v1/admin/invitations/bulk')
            .set(UNI)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ emails, role: 'alumni', expires_in_days: 7 });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data.created).toBe(2);
        (0, vitest_1.expect)(res.body.data.emails).toEqual(vitest_1.expect.arrayContaining(emails));
    });
    (0, vitest_1.it)('deduplicates emails and counts only unique', async () => {
        const ts = Date.now();
        const email = `bulk.test.dup.${ts}@uiu.ac.bd`;
        const res = await api
            .post('/api/v1/admin/invitations/bulk')
            .set(UNI)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ emails: [email, email, email], role: 'student', expires_in_days: 7 });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data.created).toBe(1);
    });
    (0, vitest_1.it)('returns 422 when emails array is empty', async () => {
        const res = await api
            .post('/api/v1/admin/invitations/bulk')
            .set(UNI)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ emails: [], role: 'student', expires_in_days: 7 });
        (0, vitest_1.expect)(res.status).toBe(422);
    });
    (0, vitest_1.it)('returns 422 when emails array exceeds 50', async () => {
        const emails = Array.from({ length: 51 }, (_, i) => `bulk.test.over${i}@uiu.ac.bd`);
        const res = await api
            .post('/api/v1/admin/invitations/bulk')
            .set(UNI)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ emails, role: 'student', expires_in_days: 7 });
        (0, vitest_1.expect)(res.status).toBe(422);
    });
    (0, vitest_1.it)('returns 403 for faculty role (admin-only endpoint)', async () => {
        const res = await api
            .post('/api/v1/admin/invitations/bulk')
            .set(UNI)
            .set('Authorization', `Bearer ${facultyToken}`)
            .send({ emails: [`bulk.test.faculty.${Date.now()}@uiu.ac.bd`], role: 'student', expires_in_days: 7 });
        (0, vitest_1.expect)(res.status).toBe(403);
    });
});
