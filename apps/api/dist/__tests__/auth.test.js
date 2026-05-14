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
        const email = `reg.${Date.now()}@uiu.ac.bd`;
        createdUserEmails.push(email);
        const res = await api.post('/api/v1/auth/register').set(UNI).send({
            email,
            password: 'TestPass@1234',
            full_name: 'Test Register',
            role: 'student',
        });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('accessToken');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('message');
        (0, vitest_1.expect)(res.body.data).toHaveProperty('user');
        (0, vitest_1.expect)(res.body.data.user).toHaveProperty('id');
    });
    (0, vitest_1.it)('returns 409 when email already exists', async () => {
        const email = `dup.${Date.now()}@uiu.ac.bd`;
        createdUserEmails.push(email);
        const payload = { email, password: 'TestPass@1234', full_name: 'Dup User', role: 'student' };
        await api.post('/api/v1/auth/register').set(UNI).send(payload);
        const res = await api.post('/api/v1/auth/register').set(UNI).send(payload);
        (0, vitest_1.expect)(res.status).toBe(409);
    });
});
(0, vitest_1.describe)('POST /api/v1/auth/verify-otp', () => {
    (0, vitest_1.it)('returns 422 with OTP_INVALID when OTP is wrong', async () => {
        // Register a fresh user so an OTP is stored in Redis
        const email = `otp.${Date.now()}@uiu.ac.bd`;
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
});
