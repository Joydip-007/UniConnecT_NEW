"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const setup_1 = require("./setup");
const api = (0, supertest_1.default)(setup_1.app);
let studentToken;
(0, vitest_1.beforeAll)(async () => {
    const st = await (0, setup_1.loginAs)(setup_1.CREDENTIALS.student.email, setup_1.CREDENTIALS.student.password);
    studentToken = st.accessToken;
});
function auth(token) {
    return { Authorization: `Bearer ${token}` };
}
(0, vitest_1.describe)('PATCH /api/v1/users/me/preferences', () => {
    (0, vitest_1.it)('persists a valid theme preference and returns it on GET /me', async () => {
        const patch = await api
            .patch('/api/v1/users/me/preferences')
            .set(auth(studentToken))
            .send({ themePreference: 'light' });
        (0, vitest_1.expect)(patch.status).toBe(200);
        (0, vitest_1.expect)(patch.body.data.themePreference).toBe('light');
        const me = await api.get('/api/v1/users/me').set(auth(studentToken));
        (0, vitest_1.expect)(me.status).toBe(200);
        (0, vitest_1.expect)(me.body.data.themePreference).toBe('light');
    });
    (0, vitest_1.it)('accepts dark and system', async () => {
        for (const value of ['dark', 'system']) {
            const res = await api
                .patch('/api/v1/users/me/preferences')
                .set(auth(studentToken))
                .send({ themePreference: value });
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.data.themePreference).toBe(value);
        }
    });
    (0, vitest_1.it)('rejects an invalid theme value with 400', async () => {
        const res = await api
            .patch('/api/v1/users/me/preferences')
            .set(auth(studentToken))
            .send({ themePreference: 'purple' });
        (0, vitest_1.expect)(res.status).toBe(422);
    });
    (0, vitest_1.it)('returns 401 without a token', async () => {
        const res = await api
            .patch('/api/v1/users/me/preferences')
            .send({ themePreference: 'dark' });
        (0, vitest_1.expect)(res.status).toBe(401);
    });
});
