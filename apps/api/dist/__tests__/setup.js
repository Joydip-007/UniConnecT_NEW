"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.CREDENTIALS = exports.TEST_UNIVERSITY_ID = exports.DOMAIN = void 0;
exports.loginAs = loginAs;
const node_http_1 = require("node:http");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const app_1 = require("../app");
const db_1 = require("../config/db");
const redis_1 = require("../config/redis");
const socket_1 = require("../socket");
exports.DOMAIN = 'uiu.ac.bd';
exports.TEST_UNIVERSITY_ID = '00000000-0000-4000-8000-000000000001';
exports.CREDENTIALS = {
    admin: { email: 'admin@uiu.ac.bd', password: 'Admin@1234', role: 'admin' },
    staff: { email: 'staff@uiu.ac.bd', password: 'Staff@1234', role: 'staff' },
    alumni: { email: 'alumni@uiu.ac.bd', password: 'Alumni@1234', role: 'alumni' },
    student: { email: 'student@uiu.ac.bd', password: 'Student@1234', role: 'student' },
};
const app = (0, app_1.createApp)();
exports.app = app;
(0, vitest_1.beforeAll)(async () => {
    // Run pending migrations (idempotent)
    await db_1.db.migrate.latest();
    // Initialize socket so services can call getIo() without throwing
    const server = (0, node_http_1.createServer)(app);
    (0, socket_1.setupSocket)(server, redis_1.redis);
    // Ensure university exists
    await (0, db_1.db)('universities')
        .insert({
        id: exports.TEST_UNIVERSITY_ID,
        name: 'United International University',
        domain: exports.DOMAIN,
        country: 'Bangladesh',
        plan: 'starter',
    })
        .onConflict('id')
        .merge({ domain: exports.DOMAIN, plan: 'starter', is_active: true });
    // Clear existing sessions so parallel test processes don't collide on the unique refresh_token constraint
    const testEmails = Object.values(exports.CREDENTIALS).map((c) => c.email);
    await (0, db_1.db)('user_sessions')
        .whereIn('user_id', (0, db_1.db)('users').select('id').whereIn('email', testEmails))
        .delete();
    // Upsert the 4 seed test users
    const entries = Object.entries(exports.CREDENTIALS);
    for (const [key, cred] of entries) {
        const hash = await bcryptjs_1.default.hash(cred.password, 10);
        const [row] = await (0, db_1.db)('users')
            .insert({
            university_id: exports.TEST_UNIVERSITY_ID,
            email: cred.email,
            password_hash: hash,
            role: cred.role,
            is_verified: true,
            is_active: true,
        })
            .onConflict('email')
            .merge({ password_hash: hash, role: cred.role, is_verified: true, is_active: true })
            .returning('id');
        await (0, db_1.db)('profiles')
            .insert({ user_id: row.id, full_name: `${key[0].toUpperCase()}${key.slice(1)} User` })
            .onConflict('user_id')
            .ignore();
    }
});
(0, vitest_1.afterAll)(async () => {
    await db_1.db.destroy();
    await redis_1.redis.quit();
});
async function loginAs(email, password) {
    const res = await (0, supertest_1.default)(app)
        .post('/api/v1/auth/login')
        .set('x-university-domain', exports.DOMAIN)
        .send({ email, password });
    if (res.status !== 200) {
        throw new Error(`loginAs(${email}) → HTTP ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const accessToken = res.body.data.accessToken;
    const raw = res.headers['set-cookie'];
    const cookie = Array.isArray(raw) ? raw.join('; ') : (raw ?? '');
    return { accessToken, cookie };
}
