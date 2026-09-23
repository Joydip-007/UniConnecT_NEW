import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, CREDENTIALS, DOMAIN, loginAs } from './setup'

// The web reads the camelCase shapes from @uniconnect/shared. Raw snake_case rows
// rendered "undefined – Present" on every education entry.

const api = supertest(app)
let token: string
let userId: string
const created: { education: string[]; experience: string[]; featured: string[] } = {
  education: [],
  experience: [],
  featured: [],
}

function auth() {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

beforeAll(async () => {
  const al = await loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password)
  token = al.accessToken
  const me = await api.get('/api/v1/users/me').set(auth())
  userId = me.body.data.id
})

afterAll(async () => {
  for (const id of created.education) await api.delete(`/api/v1/users/me/education/${id}`).set(auth())
  for (const id of created.experience) await api.delete(`/api/v1/users/me/experience/${id}`).set(auth())
  for (const id of created.featured) await api.delete(`/api/v1/users/me/featured/${id}`).set(auth())
})

describe('Profile sections return camelCase', () => {
  it('education create, update and list', async () => {
    const res = await api
      .post('/api/v1/users/me/education')
      .set(auth())
      .send({ institution: 'United International University', degree: 'BSCSE', startYear: 2021, endYear: null })
    expect(res.status).toBe(201)
    created.education.push(res.body.data.id)
    expect(res.body.data).toMatchObject({ userId, startYear: 2021, endYear: null, fieldOfStudy: null })
    expect(res.body.data).not.toHaveProperty('start_year')

    const upd = await api
      .patch(`/api/v1/users/me/education/${res.body.data.id}`)
      .set(auth())
      .send({ endYear: 2025, fieldOfStudy: 'CSE' })
    expect(upd.body.data).toMatchObject({ startYear: 2021, endYear: 2025, fieldOfStudy: 'CSE' })

    const list = await api.get(`/api/v1/users/${userId}/education`).set(auth())
    const entry = list.body.data.find((e: { id: string }) => e.id === res.body.data.id)
    expect(entry).toMatchObject({ startYear: 2021, endYear: 2025, fieldOfStudy: 'CSE' })
  })

  it('experience create and list', async () => {
    const res = await api
      .post('/api/v1/users/me/experience')
      .set(auth())
      .send({ title: 'Engineer', company: 'Acme', startDate: '2024-01-01', endDate: null })
    expect(res.status).toBe(201)
    created.experience.push(res.body.data.id)
    // A calendar date, not a timestamp — a timestamp shifts the day per viewer timezone.
    expect(res.body.data).toMatchObject({ userId, title: 'Engineer', startDate: '2024-01-01', endDate: null })

    const list = await api.get(`/api/v1/users/${userId}/experience`).set(auth())
    const entry = list.body.data.find((e: { id: string }) => e.id === res.body.data.id)
    expect(entry.startDate).toBe('2024-01-01')
  })

  it('rejects an end before the start, including via a partial PATCH', async () => {
    const bad = await api
      .post('/api/v1/users/me/education')
      .set(auth())
      .send({ institution: 'UIU', startYear: 2024, endYear: 2020 })
    expect(bad.status).toBe(400)

    const ok = await api
      .post('/api/v1/users/me/experience')
      .set(auth())
      .send({ title: 'Intern', company: 'Acme', startDate: '2024-06-01' })
    created.experience.push(ok.body.data.id)
    const patch = await api
      .patch(`/api/v1/users/me/experience/${ok.body.data.id}`)
      .set(auth())
      .send({ endDate: '2024-01-01' })
    expect(patch.status).toBe(400)
  })

  it('featured create and list', async () => {
    const res = await api
      .post('/api/v1/users/me/featured')
      .set(auth())
      .send({ type: 'link', linkUrl: 'https://example.com', linkTitle: 'Site' })
    expect(res.status).toBe(201)
    created.featured.push(res.body.data.id)
    expect(res.body.data).toMatchObject({ linkUrl: 'https://example.com', linkTitle: 'Site', displayOrder: expect.any(Number) })
  })
})

describe('Public profile privacy', () => {
  let studentToken: string

  beforeAll(async () => {
    const st = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    studentToken = st.accessToken
  })

  afterAll(async () => {
    await api.put('/api/v1/users/me/privacy').set(auth()).send({ sections: { contact_info: 'connections', education: 'everyone' } })
  })

  it('withholds email under the contact_info tier and reports section visibility', async () => {
    await api.put('/api/v1/users/me/privacy').set(auth()).send({ sections: { contact_info: 'only_me', education: 'only_me' } })
    const res = await api
      .get(`/api/v1/users/${userId}`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })
    expect(res.status).toBe(200)
    expect(res.body.data.email).toBeNull()
    expect(res.body.data.visibility).toMatchObject({ contact_info: 'hidden', education: 'hidden', experience: 'visible' })

    const own = await api.get(`/api/v1/users/${userId}`).set(auth())
    expect(own.body.data.email).toBe(CREDENTIALS.alumni.email)
    expect(own.body.data.visibility.education).toBe('visible')
  })
})
