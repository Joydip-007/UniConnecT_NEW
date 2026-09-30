import Queue from 'bull'
import { afterEach, describe, expect, it } from 'vitest'
import { bullQueueOptions, createQueue } from '../config/bull'
import { migrateLegacyQueues } from './legacy-migration'

const HOUR = 60 * 60_000

describe('migrateLegacyQueues', () => {
  const cleanup: Array<() => Promise<unknown>> = []
  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()!()
  })

  it('moves delayed jobs from an old per-type queue to its lane, keeping jobId and remaining delay', async () => {
    // What production Redis holds from before the lanes: a dedicated `mentorship` queue.
    const legacy = new Queue('mentorship', bullQueueOptions)
    legacy.on('error', () => {})
    await legacy.add({ type: 'request_expire', requestId: 'r1' }, { jobId: 'expire:r1', delay: 7 * 24 * HOUR, attempts: 3 })
    await legacy.add({ type: 'request_reminder', requestId: 'r2' }, { delay: HOUR })

    const mentorship = createQueue<{ type: string; requestId: string }>('mentorship')
    const [result] = await migrateLegacyQueues([mentorship])

    expect(result).toMatchObject({ queue: 'mentorship', moved: 2, obliterated: true })

    const expiry = await mentorship.getJob('expire:r1')
    expect(expiry).not.toBeNull()
    cleanup.push(() => expiry!.remove())
    expect(expiry!.data).toEqual({ type: 'request_expire', requestId: 'r1' })
    expect(expiry!.opts.attempts).toBe(3)
    expect(await expiry!.isDelayed()).toBe(true)
    // Still due about 7 days out, not immediately.
    expect(expiry!.timestamp + (expiry!.opts.delay ?? 0) - Date.now()).toBeGreaterThan(7 * 24 * HOUR - 60_000)

    const lane = new Queue('realtime', bullQueueOptions)
    lane.on('error', () => {})
    const delayed = await lane.getDelayed()
    const reminder = delayed.find((job) => job.name === 'mentorship' && job.data.requestId === 'r2')
    expect(reminder).toBeDefined()
    cleanup.push(() => reminder!.remove())

    // The old queue's keys are gone.
    expect(await legacy.getJobCounts()).toMatchObject({ waiting: 0, delayed: 0, active: 0 })
  })

  it('drops old repeatable schedules instead of moving them, so they are not doubled', async () => {
    const legacy = new Queue('feed-ranking', bullQueueOptions)
    legacy.on('error', () => {})
    await legacy.add({}, { repeat: { cron: '*/20 * * * *' }, jobId: 'feed-hot-score-refresh' })

    const feedRanking = createQueue('feed-ranking')
    const [result] = await migrateLegacyQueues([feedRanking])

    expect(result).toMatchObject({ moved: 0, repeatablesRemoved: 1, obliterated: true })
    expect(await legacy.getRepeatableJobs()).toHaveLength(0)
    expect(await feedRanking.getRepeatableJobs()).toHaveLength(0)
  })

  it('is a no-op once a queue has been migrated, so running it on every start is safe', async () => {
    const push = createQueue('push')
    await migrateLegacyQueues([push])
    const [second] = await migrateLegacyQueues([push])
    expect(second).toEqual({ queue: 'push', moved: 0, repeatablesRemoved: 0, obliterated: false })
  })
})
