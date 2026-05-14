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
let alumniToken;
let studentToken;
let staffToken;
let createdJobId;
const createdJobIds = [];
const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const jobPayload = {
    title: 'Software Engineer',
    company: 'UIU Tech',
    location: 'Dhaka',
    type: 'full_time',
    description: 'Join our engineering team.',
    requirements: ['TypeScript', 'Node.js'],
    deadline,
};
(0, vitest_1.beforeAll)(async () => {
    const [al, st, sf] = await Promise.all([
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.alumni.email, setup_1.CREDENTIALS.alumni.password),
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.student.email, setup_1.CREDENTIALS.student.password),
        (0, setup_1.loginAs)(setup_1.CREDENTIALS.staff.email, setup_1.CREDENTIALS.staff.password),
    ]);
    alumniToken = al.accessToken;
    studentToken = st.accessToken;
    staffToken = sf.accessToken;
});
(0, vitest_1.afterAll)(async () => {
    if (createdJobIds.length > 0) {
        // Delete applications first (FK dependency)
        await (0, db_1.db)('job_applications').whereIn('job_id', createdJobIds).delete();
        await (0, db_1.db)('saved_jobs').whereIn('job_id', createdJobIds).delete();
        await (0, db_1.db)('jobs').whereIn('id', createdJobIds).delete();
    }
});
function auth(token) {
    return { Authorization: `Bearer ${token}` };
}
(0, vitest_1.describe)('POST /api/v1/jobs', () => {
    (0, vitest_1.it)('returns 201 when alumni creates a job', async () => {
        const res = await api.post('/api/v1/jobs').set(auth(alumniToken)).send(jobPayload);
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('id');
        (0, vitest_1.expect)(res.body.data.title).toBe('Software Engineer');
        createdJobId = res.body.data.id;
        createdJobIds.push(createdJobId);
    });
    (0, vitest_1.it)('returns 403 when student tries to create a job', async () => {
        const res = await api.post('/api/v1/jobs').set(auth(studentToken)).send(jobPayload);
        (0, vitest_1.expect)(res.status).toBe(403);
    });
});
(0, vitest_1.describe)('GET /api/v1/jobs', () => {
    (0, vitest_1.it)('returns 200 with paginated items', async () => {
        const res = await api.get('/api/v1/jobs').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('items');
        (0, vitest_1.expect)(Array.isArray(res.body.data.items)).toBe(true);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('total');
    });
});
(0, vitest_1.describe)('POST /api/v1/jobs/:jobId/apply', () => {
    (0, vitest_1.it)('returns 201 when student applies', async () => {
        const res = await api
            .post(`/api/v1/jobs/${createdJobId}/apply`)
            .set(auth(studentToken))
            .send({ cover_letter: 'I am very interested.' });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('id');
    });
    (0, vitest_1.it)('returns 409 when same student applies again', async () => {
        const res = await api
            .post(`/api/v1/jobs/${createdJobId}/apply`)
            .set(auth(studentToken))
            .send({ cover_letter: 'Applying again.' });
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)(res.body.code).toBe('ALREADY_APPLIED');
    });
});
(0, vitest_1.describe)('GET /api/v1/jobs/:jobId/applications', () => {
    (0, vitest_1.it)('returns 200 for the job poster', async () => {
        const res = await api
            .get(`/api/v1/jobs/${createdJobId}/applications`)
            .set(auth(alumniToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('items');
    });
    (0, vitest_1.it)('returns 403 for a different user who is not the poster', async () => {
        // staffToken belongs to a different user who did not post this job
        const res = await api
            .get(`/api/v1/jobs/${createdJobId}/applications`)
            .set(auth(staffToken));
        (0, vitest_1.expect)(res.status).toBe(403);
    });
});
(0, vitest_1.describe)('POST /api/v1/jobs/:jobId/save', () => {
    (0, vitest_1.it)('returns 201 when student saves a job', async () => {
        const res = await api
            .post(`/api/v1/jobs/${createdJobId}/save`)
            .set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(201);
    });
});
(0, vitest_1.describe)('GET /api/v1/jobs/saved', () => {
    (0, vitest_1.it)('returns 200 with saved jobs list', async () => {
        const res = await api.get('/api/v1/jobs/saved').set(auth(studentToken));
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('items');
    });
});
