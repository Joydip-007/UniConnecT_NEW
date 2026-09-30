import { afterEach, describe, expect, it } from 'vitest'
import { createQueue, QUEUE_LANES } from './bull'

// Delayed far enough out that nothing processes them during the test.
const LATER = 60 * 60_000

describe('createQueue (logical queues on shared lanes)', () => {
  const cleanup: Array<() => Promise<unknown>> = []
  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()!()
  })

  it('carries twelve job types on two lanes', () => {
    expect(Object.keys(QUEUE_LANES)).toHaveLength(12)
    expect(new Set(Object.values(QUEUE_LANES))).toEqual(new Set(['realtime', 'batch']))
  })

  it('adds a named job to the lane and finds it again by its un-namespaced id', async () => {
    const email = createQueue<{ to: string }>('email')
    const job = await email.add({ to: 'a@uiu.ac.bd' }, { jobId: 'bull-test-1', delay: LATER })
    cleanup.push(() => job.remove())

    expect(job.name).toBe('email')
    expect(job.queue.name).toBe('realtime')
    expect(job.id).toBe('email:bull-test-1')

    const found = await email.getJob('bull-test-1')
    expect(found?.data).toEqual({ to: 'a@uiu.ac.bd' })
  })

  it('keeps two job types apart even when they pick the same jobId', async () => {
    const email = createQueue<{ n: number }>('email')
    const push = createQueue<{ n: number }>('push')
    const a = await email.add({ n: 1 }, { jobId: 'bull-test-same', delay: LATER })
    const b = await push.add({ n: 2 }, { jobId: 'bull-test-same', delay: LATER })
    cleanup.push(() => a.remove(), () => b.remove())

    expect((await email.getJob('bull-test-same'))?.data).toEqual({ n: 1 })
    expect((await push.getJob('bull-test-same'))?.data).toEqual({ n: 2 })
  })

  it('reports repeatable jobs for its own type only, with the id the caller chose', async () => {
    const feed = createQueue('feed-ranking')
    const digest = createQueue('group-digest')
    await feed.add({}, { repeat: { cron: '0 0 1 1 *' }, jobId: 'bull-test-repeat' })
    await digest.add({}, { repeat: { cron: '0 0 1 1 *' }, jobId: 'bull-test-repeat-other' })
    const mine = await feed.getRepeatableJobs()
    const theirs = await digest.getRepeatableJobs()
    cleanup.push(async () => {
      for (const job of [...mine, ...theirs]) await feed.removeRepeatableByKey(job.key)
    })

    expect(mine.map((job) => job.id)).toContain('bull-test-repeat')
    expect(mine.map((job) => job.id)).not.toContain('bull-test-repeat-other')
  })
})
