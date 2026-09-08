import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app, loginAs, DOMAIN } from '../../__tests__/setup'
import { aiContentQueue } from '../../queues/ai-content.queue'

describe('POST /admin/learning/generate', () => {
  beforeEach(() => {
    vi.spyOn(aiContentQueue, 'add').mockResolvedValue(undefined as never)
  })

  it('enqueues only learning-gen when task=learning', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'Admin@1234')
    const res = await request(app)
      .post('/api/v1/admin/learning/generate')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ task: 'learning' })
    expect(res.status).toBe(200)
    expect(aiContentQueue.add).toHaveBeenCalledTimes(1)
    expect(aiContentQueue.add).toHaveBeenCalledWith(expect.objectContaining({ task: 'learning-gen' }))
  })

  it('enqueues only quiz-gen when task=quiz', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'Admin@1234')
    const res = await request(app)
      .post('/api/v1/admin/learning/generate')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ task: 'quiz' })
    expect(res.status).toBe(200)
    expect(aiContentQueue.add).toHaveBeenCalledTimes(1)
    expect(aiContentQueue.add).toHaveBeenCalledWith(expect.objectContaining({ task: 'quiz-gen' }))
  })

  it('defaults to both when task is omitted (back-compat with the AI settings tab)', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'Admin@1234')
    const res = await request(app)
      .post('/api/v1/admin/learning/generate')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
    expect(res.status).toBe(200)
    expect(aiContentQueue.add).toHaveBeenCalledTimes(2)
  })
})
