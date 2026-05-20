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
// Track created users for cleanup
const createdUserEmails = [];
(0, vitest_1.afterAll)(async () => {
    if (createdUserEmails.length > 0) {
        await (0, db_1.db)('users').whereIn('email', createdUserEmails).delete();
    }
});
(0, vitest_1.describe)('POST /api/v1/auth/register', () => {
    (0, vitest_1.it)('returns 201 with accessToken on success', async () => {
        const email = `reg.${Date.now()}@bscse.uiu.ac.bd`;
        createdUserEmails.push(email);
        const res = await api.post('/api/v1/auth/register').set(UNI).send({
            email,
            password: 'TestPass@1234',
            full_name: 'Test Register',
            role: 'student',
        });
        if (res.status !== 201)
            console.log(res.body);
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('accessToken');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('message');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('user');
        (0, vitest_1.expect)(res.body.data.user).toHaveProperty('id');
    });
    (0, vitest_1.it)('returns 409 when email already exists', async () => {
        const email = `dup.${Date.now()}@bscse.uiu.ac.bd`;
        createdUserEmails.push(email);
        const payload = { email, password: 'TestPass@1234', full_name: 'Dup User', role: 'student' };
        await api.post('/api/v1/auth/register').set(UNI).send(payload);
        const res = await api.post('/api/v1/auth/register').set(UNI).send(payload);
        (0, vitest_1.expect)(res.status).toBe(409);
    });
    (0, vitest_1.it)('stores department in profile when provided at registration', async () => {
        const email = `dept.${Date.now()}@bscse.uiu.ac.bd`;
        createdUserEmails.push(email);
        const res = await api.post('/api/v1/auth/register').set(UNI).send({
            email,
            password: 'TestPass@1234',
            full_name: 'Dept Tester',
            role: 'student',
            department: 'EEE',
        });
        (0, vitest_1.expect)(res.status).toBe(201);
        // Verify department persisted
        const profile = await (0, db_1.db)('profiles')
            .join('users', 'users.id', 'profiles.user_id')
            .where('users.email', email)
            .select('profiles.department')
            .first();
        (0, vitest_1.expect)(profile?.department).toBe('EEE');
    });
});
(0, vitest_1.describe)('POST /api/v1/auth/verify-otp', () => {
    (0, vitest_1.it)('returns 422 with OTP_INVALID when OTP is wrong', async () => {
        // Register a fresh user so an OTP is stored in Redis
        const email = `otp.${Date.now()}@bscse.uiu.ac.bd`;
        createdUserEmails.push(email);
        const reg = await api.post('/api/v1/auth/register').set(UNI).send({
            email,
            password: 'TestPass@1234',
            full_name: 'OTP Tester',
            role: 'student',
        });
        (0, vitest_1.expect)(reg.status).toBe(201);
        // Verify with wrong OTP
        const res = await api.post('/api/v1/auth/verify-otp').set(UNI).send({
            email,
            otp: '000000',
            purpose: 'verify',
        });
        (0, vitest_1.expect)(res.status).toBe(422);
        (0, vitest_1.expect)(res.body.code).toBe('OTP_INVALID');
    });
});
(0, vitest_1.describe)('POST /api/v1/auth/login', () => {
    (0, vitest_1.it)('returns 401 with wrong password', async () => {
        const res = await api.post('/api/v1/auth/login').set(UNI).send({
            email: setup_1.CREDENTIALS.student.email,
            password: 'WrongPassword1!',
        });
        (0, vitest_1.expect)(res.status).toBe(401);
    });
    (0, vitest_1.it)('returns 200 with valid credentials', async () => {
        const res = await api.post('/api/v1/auth/login').set(UNI).send({
            email: setup_1.CREDENTIALS.student.email,
            password: setup_1.CREDENTIALS.student.password,
        });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('accessToken');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('user');
    });
});
(0, vitest_1.describe)('POST /api/v1/auth/refresh', () => {
    (0, vitest_1.it)('returns 200 with a new accessToken when cookie is valid', async () => {
        const { cookie } = await (0, setup_1.loginAs)(setup_1.CREDENTIALS.student.email, setup_1.CREDENTIALS.student.password);
        const res = await api
            .post('/api/v1/auth/refresh')
            .set('Cookie', cookie)
            .set(UNI);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('accessToken');
    });
    (0, vitest_1.it)('returns 401 when no cookie is sent', async () => {
        const res = await api.post('/api/v1/auth/refresh').set(UNI);
        (0, vitest_1.expect)(res.status).toBe(401);
    });
});
(0, vitest_1.describe)('POST /api/v1/auth/logout', () => {
    (0, vitest_1.it)('returns 204 and clears cookie', async () => {
        const { accessToken, cookie } = await (0, setup_1.loginAs)(setup_1.CREDENTIALS.student.email, setup_1.CREDENTIALS.student.password);
        const res = await api
            .post('/api/v1/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`)
            .set('Cookie', cookie)
            .set(UNI);
        (0, vitest_1.expect)(res.status).toBe(204);
    });
});
(0, vitest_1.describe)('GET /api/v1/auth/me', () => {
    let accessToken;
    (0, vitest_1.beforeAll)(async () => {
        const tokens = await (0, setup_1.loginAs)(setup_1.CREDENTIALS.student.email, setup_1.CREDENTIALS.student.password);
        accessToken = tokens.accessToken;
    });
    (0, vitest_1.it)('returns 200 with user object when authenticated', async () => {
        const res = await api
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .set(UNI);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('id');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('email');
        (0, vitest_1.expect)(res.body.data.email).toBe(setup_1.CREDENTIALS.student.email);
    });
    (0, vitest_1.it)('returns 401 when no token is sent', async () => {
        const res = await api.get('/api/v1/auth/me').set(UNI);
        (0, vitest_1.expect)(res.status).toBe(401);
    });
    (0, vitest_1.it)('returns real profile data including department', async () => {
        const { accessToken: token } = await (0, setup_1.loginAs)(setup_1.CREDENTIALS.student.email, setup_1.CREDENTIALS.student.password);
        // Set department directly in DB so we can verify the field comes back
        const userRow = await (0, db_1.db)('users').where({ email: setup_1.CREDENTIALS.student.email }).select('id').first();
        await (0, db_1.db)('profiles').where({ user_id: userRow.id }).update({ department: 'CSE', batch_year: '2025' });
        const res = await api.get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .set(UNI);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.profile.department).toBe('CSE');
        (0, vitest_1.expect)(res.body.data.profile.batchYear).toBe('2025');
        // Clean up
        await (0, db_1.db)('profiles').where({ user_id: userRow.id }).update({ department: null, batch_year: null });
    });
});
(0, vitest_1.describe)('GET /api/v1/auth/invitation/:token', () => {
    const testToken = `peek-test-${Date.now()}`;
    const testEmail = `peek.${Date.now()}@bscse.uiu.ac.bd`;
    (0, vitest_1.beforeAll)(async () => {
        await (0, db_1.db)('invitations').insert({
            university_id: setup_1.TEST_UNIVERSITY_ID,
            email: testEmail,
            role: 'student',
            token: testToken,
            is_used: false,
            expires_at: new Date(Date.now() + 60 * 60 * 1000),
        });
    });
    (0, vitest_1.afterAll)(async () => {
        await (0, db_1.db)('invitations').where({ token: testToken }).delete();
    });
    (0, vitest_1.it)('returns 200 with role and email for a valid token', async () => {
        const res = await api
            .get(`/api/v1/auth/invitation/${testToken}`)
            .set(UNI);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data.role).toBe('student');
        (0, vitest_1.expect)(res.body.data.email).toBe(testEmail);
    });
    (0, vitest_1.it)('returns 404 for an unknown token', async () => {
        const res = await api
            .get('/api/v1/auth/invitation/does-not-exist')
            .set(UNI);
        (0, vitest_1.expect)(res.status).toBe(404);
    });
});
