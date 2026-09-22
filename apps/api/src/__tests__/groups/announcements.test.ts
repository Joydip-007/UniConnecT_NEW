import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'
import { app, DOMAIN, loginAs, CREDENTIALS } from '../setup'

describe('group announcements + consultation slots/bookings', () => {
  let faculty: { accessToken: string }
  let student: { accessToken: string }
  let academicGroupId: string
  let clubGroupId: string

  beforeAll(async () => {
    faculty = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)

    const academic = await request(app)
      .post('/api/v1/groups')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ name: 'CSE Announcements Section', description: 'x', type: 'academic', is_private: false })
    academicGroupId = academic.body.data.id

    await request(app)
      .post(`/api/v1/groups/${academicGroupId}/members`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})

    const club = await request(app)
      .post('/api/v1/groups')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ name: 'Non Academic Announcements Club', description: 'x', type: 'club', is_private: false })
    clubGroupId = club.body.data.id

    await request(app)
      .post(`/api/v1/groups/${clubGroupId}/members`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})
  })

  describe('announcements', () => {
    it('lets the owner (faculty) create an urgent announcement, but not a plain member', async () => {
      const asFaculty = await request(app)
        .post(`/api/v1/groups/${academicGroupId}/announcements`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({ title: 'Midterm rescheduled', body: 'New date is Monday', kind: 'urgent' })

      expect(asFaculty.status).toBe(201)
      expect(asFaculty.body.data.kind).toBe('urgent')
      expect(asFaculty.body.data.title).toBe('Midterm rescheduled')
      expect(asFaculty.body.data.author.id).toBeDefined()

      const asStudent = await request(app)
        .post(`/api/v1/groups/${academicGroupId}/announcements`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ title: 'Not allowed', body: 'x', kind: 'notice' })

      expect(asStudent.status).toBe(403)
    })

    it('rejects announcements on a non-academic group', async () => {
      const res = await request(app)
        .post(`/api/v1/groups/${clubGroupId}/announcements`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({ title: 'x', body: 'x', kind: 'notice' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('GROUP_NOT_ACADEMIC')
    })

    it('lists announcements pinned first', async () => {
      await request(app)
        .post(`/api/v1/groups/${academicGroupId}/announcements`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({ title: 'Regular notice', body: 'body', kind: 'notice' })

      const pinned = await request(app)
        .post(`/api/v1/groups/${academicGroupId}/announcements`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({ title: 'Pin me', body: 'body', kind: 'schedule' })
      const pinnedId = pinned.body.data.id

      await request(app)
        .patch(`/api/v1/groups/${academicGroupId}/announcements/${pinnedId}`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({ is_pinned: true })

      const list = await request(app)
        .get(`/api/v1/groups/${academicGroupId}/announcements`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${student.accessToken}`)

      expect(list.status).toBe(200)
      expect(list.body.data.items[0].id).toBe(pinnedId)
      expect(list.body.data.items[0].isPinned).toBe(true)
    })

    it('deletes an announcement as admin', async () => {
      const created = await request(app)
        .post(`/api/v1/groups/${academicGroupId}/announcements`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({ title: 'To delete', body: 'body', kind: 'notice' })

      const del = await request(app)
        .delete(`/api/v1/groups/${academicGroupId}/announcements/${created.body.data.id}`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)

      expect(del.status).toBe(200)

      const list = await request(app)
        .get(`/api/v1/groups/${academicGroupId}/announcements`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${student.accessToken}`)
      expect(list.body.data.items.some((i: { id: string }) => i.id === created.body.data.id)).toBe(false)
    })
  })

  describe('consultation slots + bookings', () => {
    let slotId: string

    it('lets owner create a slot', async () => {
      const res = await request(app)
        .post(`/api/v1/groups/${academicGroupId}/consultation-slots`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({ weekday: 2, start_time: '15:00', end_time: '16:00', location: 'Room 401', walk_in: false })

      expect(res.status).toBe(201)
      expect(res.body.data.id).toBeDefined()
      slotId = res.body.data.id
    })

    it('rejects slot creation by a plain member', async () => {
      const res = await request(app)
        .post(`/api/v1/groups/${academicGroupId}/consultation-slots`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ weekday: 3, start_time: '10:00', end_time: '11:00', location: 'Room 1', walk_in: false })

      expect(res.status).toBe(403)
    })

    it('lets a student book the slot, rejects a second booking same day, and lists myBooking', async () => {
      const first = await request(app)
        .post(`/api/v1/groups/${academicGroupId}/consultation-slots/${slotId}/book`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ topic: 'Need help with assignment 3' })

      expect(first.status).toBe(201)
      expect(first.body.data.status).toBe('requested')
      const bookingId = first.body.data.id

      const second = await request(app)
        .post(`/api/v1/groups/${academicGroupId}/consultation-slots/${slotId}/book`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ topic: 'Another topic' })

      expect(second.status).toBe(409)
      expect(second.body.code).toBe('SLOT_ALREADY_BOOKED')

      const listAsStudent = await request(app)
        .get(`/api/v1/groups/${academicGroupId}/consultation-slots`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${student.accessToken}`)

      expect(listAsStudent.status).toBe(200)
      const slotForStudent = listAsStudent.body.data.items.find((s: { id: string }) => s.id === slotId)
      expect(slotForStudent.myBooking).toMatchObject({ id: bookingId, status: 'requested' })
      expect(slotForStudent.bookings).toBeUndefined()
      expect(typeof slotForStudent.nextOccurrence).toBe('string')

      const listAsFaculty = await request(app)
        .get(`/api/v1/groups/${academicGroupId}/consultation-slots`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
      const slotForFaculty = listAsFaculty.body.data.items.find((s: { id: string }) => s.id === slotId)
      expect(Array.isArray(slotForFaculty.bookings)).toBe(true)
      expect(slotForFaculty.bookings.some((b: { id: string }) => b.id === bookingId)).toBe(true)

      const confirm = await request(app)
        .patch(`/api/v1/groups/${academicGroupId}/consultation-slots/${slotId}/bookings/${bookingId}`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({ status: 'confirmed' })

      expect(confirm.status).toBe(200)
      expect(confirm.body.data.status).toBe('confirmed')
    })

    it('rejects booking review by a plain member', async () => {
      const res = await request(app)
        .patch(`/api/v1/groups/${academicGroupId}/consultation-slots/${slotId}/bookings/00000000-0000-4000-8000-000000000099`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ status: 'declined' })

      expect(res.status).toBe(403)
    })

    it('deletes a slot as admin', async () => {
      const created = await request(app)
        .post(`/api/v1/groups/${academicGroupId}/consultation-slots`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({ weekday: 4, start_time: '09:00', end_time: '10:00', location: 'Room 2', walk_in: true })

      const del = await request(app)
        .delete(`/api/v1/groups/${academicGroupId}/consultation-slots/${created.body.data.id}`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)

      expect(del.status).toBe(200)
    })
  })
})
