import request from 'supertest'
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

const { mockGenerateContent } = vi.hoisted(() => ({ mockGenerateContent: vi.fn() }))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent }
    }
  },
}))

import { app, DOMAIN, loginAs, CREDENTIALS } from '../setup'
import { extractCourseOutline } from '../../services/ai.service'
import { getPublicUrlPrefix } from '../../services/upload.service'

const OUTLINE_TEXT = `CSE 3422 Software Engineering Laboratory
Section A, Summer 2026
Week 1 (1-7 Jun): Introduction to SE
Week 2 (8-14 Jun): Requirements
Assessment: Class tests 20%, Assignments 30%, Final 50%
Assignment 1 due 20 Jun 2026 on Requirements`

const GEMINI_DRAFT = {
  courseCode: 'CSE 3422',
  courseTitle: 'Software Engineering Laboratory',
  section: 'A',
  topics: [
    { weekNumber: 1, title: 'Introduction to SE', dateRange: '1-7 Jun' },
    { weekNumber: 2, title: 'Requirements', dateRange: '8-14 Jun' },
  ],
  assessments: [
    { categoryName: 'Class tests', weightPercent: 20, fullMarks: 20, totalGiven: 2 },
    { categoryName: 'Assignments', weightPercent: 30, fullMarks: 100, totalGiven: 1 },
    { categoryName: 'Final', weightPercent: 50, fullMarks: 100, totalGiven: 1 },
  ],
  assignments: [
    { title: 'Assignment 1', dueDate: '2026-06-20', topic: 'Requirements', kind: 'assignment' },
    { title: 'Class Test 1', dueDate: null, topic: 'Introduction to SE', kind: 'class_test' },
  ],
}

function geminiReplies(payload: unknown) {
  mockGenerateContent.mockResolvedValueOnce({ response: { text: () => JSON.stringify(payload) } })
}

describe('ai.service.extractCourseOutline', () => {
  afterEach(() => mockGenerateContent.mockReset())

  it('sends the outline text to Gemini and validates the strict-JSON reply', async () => {
    geminiReplies(GEMINI_DRAFT)
    const result = await extractCourseOutline(OUTLINE_TEXT)
    expect(result).toEqual(GEMINI_DRAFT)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    expect(String(mockGenerateContent.mock.calls[0]![0])).toContain('CSE 3422 Software Engineering Laboratory')
  })

  it('rejects a reply that does not match the schema', async () => {
    geminiReplies({ courseTitle: 42 })
    await expect(extractCourseOutline(OUTLINE_TEXT)).rejects.toThrow()
  })
})

describe('course-outline import over HTTP', () => {
  let faculty: { accessToken: string }
  let student: { accessToken: string }
  const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN })

  beforeAll(async () => {
    faculty = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  })

  afterEach(() => {
    mockGenerateContent.mockReset()
    vi.unstubAllGlobals()
  })

  it('POST /groups/course-outline/draft rejects a file URL outside the upload bucket', async () => {
    const res = await request(app)
      .post('/api/v1/groups/course-outline/draft')
      .set(auth(faculty.accessToken))
      .send({ file_url: 'https://evil.example.com/outline.pdf' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ATTACHMENT_URL_INVALID')
  })

  it('POST /groups/course-outline/draft is faculty/admin only', async () => {
    const res = await request(app)
      .post('/api/v1/groups/course-outline/draft')
      .set(auth(student.accessToken))
      .send({ file_url: `${getPublicUrlPrefix()}outline.txt` })
    expect(res.status).toBe(403)
  })

  it('POST /groups/course-outline/draft fetches the file + roster and returns a draft', async () => {
    const prefix = getPublicUrlPrefix()
    const files: Record<string, string> = {
      [`${prefix}outline.txt`]: OUTLINE_TEXT,
      [`${prefix}roster.csv`]: 'name,email\nA,a@uiu.ac.bd\nB,B@uiu.ac.bd\nC,a@uiu.ac.bd\n',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = files[url]
        if (body === undefined) return new Response(null, { status: 404 })
        return new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } })
      }),
    )
    geminiReplies(GEMINI_DRAFT)

    const res = await request(app)
      .post('/api/v1/groups/course-outline/draft')
      .set(auth(faculty.accessToken))
      .send({ file_url: `${prefix}outline.txt`, roster_url: `${prefix}roster.csv` })

    expect(res.status).toBe(200)
    const { draft, rosterEmails } = res.body.data
    expect(draft.courseCode).toBe('CSE 3422')
    expect(draft.courseTitle).toBe('Software Engineering Laboratory')
    expect(draft.section).toBe('A')
    expect(draft.gradingScale).toBe('uiu')
    expect(draft.topics).toEqual([
      { weekNumber: 1, title: 'Introduction to SE', description: '1-7 Jun' },
      { weekNumber: 2, title: 'Requirements', description: '8-14 Jun' },
    ])
    expect(draft.assessments[0]).toMatchObject({
      categoryName: 'Class tests',
      weightPercent: 20,
      fullMarks: 20,
      totalGiven: 2,
      bestNCounted: 2,
      displayOrder: 1,
    })
    expect(draft.assignments).toEqual(GEMINI_DRAFT.assignments)
    expect(rosterEmails).toEqual(['a@uiu.ac.bd', 'b@uiu.ac.bd'])
  })

  it('POST /groups/from-outline creates the academic group, outline and unpublished assignments', async () => {
    const draft = {
      courseCode: 'CSE 3422',
      courseTitle: 'Software Engineering Laboratory',
      section: 'A',
      gradingScale: 'uiu',
      assessments: [
        { categoryName: 'Class tests', weightPercent: 20, fullMarks: 20, totalGiven: 2, bestNCounted: 2, displayOrder: 1 },
        { categoryName: 'Final', weightPercent: 80, fullMarks: 100, totalGiven: 1, bestNCounted: 1, displayOrder: 2 },
      ],
      topics: [
        { weekNumber: 1, title: 'Introduction to SE', description: '1-7 Jun' },
        { weekNumber: 2, title: 'Requirements' },
      ],
      assignments: [
        { title: 'Assignment 1', dueDate: '2026-06-20', topic: 'Requirements', kind: 'assignment' },
        { title: 'Class Test 1', dueDate: null, topic: null, kind: 'class_test' },
      ],
    }

    const created = await request(app)
      .post('/api/v1/groups/from-outline')
      .set(auth(faculty.accessToken))
      .send({ name: 'CSE 3422 Section A (import test)', section: 'A', draft, is_private: false })

    expect(created.status).toBe(201)
    const group = created.body.data
    expect(group.type).toBe('academic')
    expect(group.allowedRole).toBe('student')
    expect(group.userRole).toBe('owner')

    const outline = await request(app)
      .get(`/api/v1/groups/${group.id}/course-outline`)
      .set(auth(faculty.accessToken))
    expect(outline.status).toBe(200)
    expect(outline.body.data.courseCode).toBe('CSE 3422')
    expect(outline.body.data.topics.map((t: { title: string }) => t.title)).toEqual([
      'Introduction to SE',
      'Requirements',
    ])
    expect(outline.body.data.assessments).toHaveLength(2)

    const assignments = await request(app)
      .get(`/api/v1/groups/${group.id}/assignments`)
      .set(auth(faculty.accessToken))
    expect(assignments.status).toBe(200)
    const items = assignments.body.data as { title: string; isPublished: boolean; deadline: string | null }[]
    expect(items.map((a) => a.title).sort()).toEqual(['Assignment 1', 'Class Test 1'])
    expect(items.every((a) => a.isPublished === false)).toBe(true)
    expect(items.find((a) => a.title === 'Assignment 1')!.deadline).toMatch(/^2026-06-20/)
  })

  it('POST /groups/from-outline rejects an invalid draft with 422 and creates no group', async () => {
    const res = await request(app)
      .post('/api/v1/groups/from-outline')
      .set(auth(faculty.accessToken))
      .send({
        name: 'Should not exist',
        draft: {
          courseTitle: 'Broken',
          gradingScale: 'uiu',
          assessments: [{ categoryName: 'Final', weightPercent: 40, fullMarks: 100, totalGiven: 1, bestNCounted: 1, displayOrder: 1 }],
          topics: [],
          assignments: [],
        },
        is_private: false,
      })
    expect(res.status).toBe(422)

    const list = await request(app)
      .get('/api/v1/groups?search=Should%20not%20exist')
      .set(auth(faculty.accessToken))
    const names = (list.body.data?.items ?? []).map((g: { name: string }) => g.name)
    expect(names).not.toContain('Should not exist')
  })

  it('POST /groups/from-outline is forbidden for students', async () => {
    const res = await request(app)
      .post('/api/v1/groups/from-outline')
      .set(auth(student.accessToken))
      .send({ name: 'x', draft: {}, is_private: false })
    expect(res.status).toBe(403)
  })
})
