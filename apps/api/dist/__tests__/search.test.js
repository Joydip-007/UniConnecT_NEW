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
    return { Authorization: `Bearer ${token}`, 'x-university-domain': setup_1.DOMAIN };
}
(0, vitest_1.describe)('GET /api/v1/search', () => {
    (0, vitest_1.it)('returns 422 when q is missing', async () => {
        const res = await api.get('/api/v1/search').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(422);
    });
    (0, vitest_1.it)('returns 422 when q is less than 2 characters', async () => {
        const res = await api.get('/api/v1/search?q=a').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(422);
    });
    (0, vitest_1.it)('returns 200 with all five category arrays', async () => {
        const res = await api.get('/api/v1/search?q=user').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        const data = res.body.data;
        (0, vitest_1.expect)(data).toHaveProperty('people');
        (0, vitest_1.expect)(data).toHaveProperty('posts');
        (0, vitest_1.expect)(data).toHaveProperty('jobs');
        (0, vitest_1.expect)(data).toHaveProperty('events');
        (0, vitest_1.expect)(data).toHaveProperty('groups');
        (0, vitest_1.expect)(Array.isArray(data.people)).toBe(true);
        (0, vitest_1.expect)(Array.isArray(data.posts)).toBe(true);
        (0, vitest_1.expect)(Array.isArray(data.jobs)).toBe(true);
        (0, vitest_1.expect)(Array.isArray(data.events)).toBe(true);
        (0, vitest_1.expect)(Array.isArray(data.groups)).toBe(true);
    });
    (0, vitest_1.it)('returns 401 without auth token', async () => {
        const res = await api.get('/api/v1/search?q=user').set('x-university-domain', setup_1.DOMAIN);
        (0, vitest_1.expect)(res.status).toBe(401);
    });
});
(0, vitest_1.describe)('GET /api/v1/search/people', () => {
    (0, vitest_1.it)('returns 200 with paginated shape', async () => {
        const res = await api.get('/api/v1/search/people?q=user').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        const data = res.body.data;
        (0, vitest_1.expect)(data).toHaveProperty('items');
        (0, vitest_1.expect)(data).toHaveProperty('total');
        (0, vitest_1.expect)(data).toHaveProperty('page');
        (0, vitest_1.expect)(data).toHaveProperty('hasMore');
        (0, vitest_1.expect)(Array.isArray(data.items)).toBe(true);
    });
    (0, vitest_1.it)('people items have expected fields', async () => {
        const res = await api.get('/api/v1/search/people?q=student').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        const items = res.body.data.items;
        if (items.length > 0) {
            const item = items[0];
            (0, vitest_1.expect)(item).toHaveProperty('id');
            (0, vitest_1.expect)(item).toHaveProperty('fullName');
            (0, vitest_1.expect)(item).toHaveProperty('role');
            (0, vitest_1.expect)(typeof item.isFollowing).toBe('boolean');
        }
    });
});
(0, vitest_1.describe)('GET /api/v1/search/posts', () => {
    (0, vitest_1.it)('returns 200 with paginated shape', async () => {
        const res = await api.get('/api/v1/search/posts?q=test').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        const data = res.body.data;
        (0, vitest_1.expect)(data).toHaveProperty('items');
        (0, vitest_1.expect)(data).toHaveProperty('total');
        (0, vitest_1.expect)(Array.isArray(data.items)).toBe(true);
    });
});
(0, vitest_1.describe)('GET /api/v1/search/jobs', () => {
    (0, vitest_1.it)('returns 200 with paginated shape', async () => {
        const res = await api.get('/api/v1/search/jobs?q=engineer').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        const data = res.body.data;
        (0, vitest_1.expect)(data).toHaveProperty('items');
        (0, vitest_1.expect)(Array.isArray(data.items)).toBe(true);
    });
});
(0, vitest_1.describe)('GET /api/v1/search/events', () => {
    (0, vitest_1.it)('returns 200 with paginated shape', async () => {
        const res = await api.get('/api/v1/search/events?q=tech').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        const data = res.body.data;
        (0, vitest_1.expect)(data).toHaveProperty('items');
        (0, vitest_1.expect)(Array.isArray(data.items)).toBe(true);
    });
});
(0, vitest_1.describe)('GET /api/v1/search/groups', () => {
    (0, vitest_1.it)('returns 200 with paginated shape', async () => {
        const res = await api.get('/api/v1/search/groups?q=club').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        const data = res.body.data;
        (0, vitest_1.expect)(data).toHaveProperty('items');
        (0, vitest_1.expect)(Array.isArray(data.items)).toBe(true);
    });
});
