import Queue from 'bull'
import Redis from 'ioredis'
import { env } from './env'
import { watchRedisClient } from './redis-errors'

const isTls = env.REDIS_URL.startsWith('rediss://')

const BASE_OPTS = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(isTls && { tls: {} }),
}

function makeBullClient(label: string): Redis {
  const client = new Redis(env.REDIS_URL, BASE_OPTS)
  watchRedisClient(client, label)
  return client
}

// One shared client for regular commands (LPUSH, ZADD, GET …) — ioredis
// queues commands internally so sharing across all queues/workers is safe.
const sharedClient = makeBullClient('bull:client')

// One shared subscriber — each queue subscribes to its own channel pattern
// (bull:{name}:*), so a single ioredis connection handles all of them correctly.
const sharedSubscriber = makeBullClient('bull:subscriber')

// Each Bull queue instance (the two lanes, plus the legacy queues the startup migration
// opens) attaches its own 'error' and 'ready' listeners to the two shared clients above,
// which trips Node's default MaxListeners of 10.
sharedClient.setMaxListeners(50)
sharedSubscriber.setMaxListeners(50)

/**
 * Shared Bull QueueOptions for the physical lane queues (and the legacy-queue migration).
 *
 * Bull v4 calls createClient with 'client', 'subscriber', and 'bclient' per queue
 * instance. 'client' and 'subscriber' are shared by every queue. 'bclient' cannot be:
 * it issues BRPOPLPUSH, which blocks its connection until a job arrives, so each
 * queue instance that processes jobs gets its own. That's why the job types share
 * two physical queues (see `createQueue`), not twelve.
 *
 * defaultJobOptions caps job history so completed/failed job data doesn't
 * accumulate forever — the Redis Cloud plan backing this app has a small
 * fixed maxmemory and its eviction policy (volatile-lru) only reclaims keys
 * with a TTL, which Bull job keys don't have, so unbounded retention leads
 * straight to OOM errors on writes/subscribes once the plan limit is hit.
 */
export const bullQueueOptions = {
  prefix: env.BULL_PREFIX,
  createClient(type: 'client' | 'subscriber' | 'bclient'): Redis {
    switch (type) {
      case 'client':     return sharedClient
      case 'subscriber': return sharedSubscriber
      case 'bclient':    return makeBullClient('bull:bclient')
    }
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
}

/**
 * Every job type the app enqueues, and the physical queue ("lane") that carries it.
 *
 * Each physical queue with a processor holds one blocking Redis connection, and
 * during a restart the old and new instance hold theirs at the same time. Twelve
 * queues cost 12 blocking connections per instance, enough for an overlapping
 * restart to hit the Redis Cloud connection cap and crash the new container
 * (2026-09-30). Two lanes cost 2.
 *
 * Two lanes rather than one, so a slow job (a 10-minute content-sync, a Gemini
 * run) cannot hold up the user-facing ones.
 */
export const QUEUE_LANES = {
  email: 'realtime',
  notification: 'realtime',
  push: 'realtime',
  badge: 'realtime',
  mentorship: 'realtime',
  'post-lifecycle': 'realtime',
  'ai-content': 'batch',
  'content-sync': 'batch',
  'feed-ranking': 'batch',
  'group-digest': 'batch',
  'notification-digest': 'batch',
  learning: 'batch',
} as const

export type QueueName = keyof typeof QUEUE_LANES
type Lane = (typeof QUEUE_LANES)[QueueName]

const lanes = new Map<Lane, Queue.Queue>()

function laneQueue(lane: Lane): Queue.Queue {
  let queue = lanes.get(lane)
  if (!queue) {
    queue = new Queue(lane, bullQueueOptions)
    // Bull re-emits its Redis clients' errors on the queue, and an EventEmitter
    // with no `error` listener throws, which exits the process.
    watchRedisClient(queue, `lane:${lane}`)
    lanes.set(lane, queue)
  }
  return queue
}

type JobEvent = 'completed' | 'failed' | 'active' | 'stalled' | 'progress' | 'waiting'

/**
 * One job type, carried as named jobs on its lane. It keeps the slice of the Bull
 * Queue API the app uses, so callers read the same as with a dedicated queue.
 */
export interface LogicalQueue<T = unknown> {
  readonly name: QueueName
  add(data: T, opts?: Queue.JobOptions): Promise<Queue.Job<T>>
  process(handler: Queue.ProcessPromiseFunction<T>): Promise<void>
  process(concurrency: number, handler: Queue.ProcessPromiseFunction<T>): Promise<void>
  /** Job events fire only for this job type's jobs, not the whole lane's. */
  on(event: 'failed', listener: (job: Queue.Job<T>, error: Error) => void): LogicalQueue<T>
  on(event: 'completed', listener: (job: Queue.Job<T>, result: unknown) => void): LogicalQueue<T>
  on(event: Exclude<JobEvent, 'failed' | 'completed'>, listener: (job: Queue.Job<T>) => void): LogicalQueue<T>
  getJob(jobId: string): Promise<Queue.Job<T> | null>
  getRepeatableJobs(): Promise<Queue.JobInformation[]>
  removeRepeatableByKey(key: string): Promise<void>
}

export function createQueue<T = unknown>(name: QueueName): LogicalQueue<T> {
  const lane = () => laneQueue(QUEUE_LANES[name]) as Queue.Queue<T>
  // Job ids are unique per physical queue, so namespace caller-chosen ids by type.
  // Not for repeatable jobs: Bull already keys those by job name, and it splits the
  // repeat key on ':', so a prefixed id would shift every field it parses back out.
  const prefix = `${name}:`
  const scoped = (jobId: Queue.JobId) => `${prefix}${jobId}`

  function on(event: 'failed', listener: (job: Queue.Job<T>, error: Error) => void): LogicalQueue<T>
  function on(event: 'completed', listener: (job: Queue.Job<T>, result: unknown) => void): LogicalQueue<T>
  function on(event: Exclude<JobEvent, 'failed' | 'completed'>, listener: (job: Queue.Job<T>) => void): LogicalQueue<T>
  function on(event: JobEvent, listener: (job: Queue.Job<T>, arg: never) => void): LogicalQueue<T> {
    lane().on(event, (job: Queue.Job<T> | undefined, arg: unknown) => {
      if (job?.name === name) listener(job, arg as never)
    })
    return logical
  }

  const logical: LogicalQueue<T> = {
    name,
    add(data, opts) {
      if (opts?.jobId === undefined || opts.repeat) return lane().add(name, data, opts)
      return lane().add(name, data, { ...opts, jobId: scoped(opts.jobId) })
    },
    process(concurrencyOrHandler: number | Queue.ProcessPromiseFunction<T>, maybeHandler?: Queue.ProcessPromiseFunction<T>) {
      if (typeof concurrencyOrHandler === 'number') {
        return lane().process(name, concurrencyOrHandler, maybeHandler!)
      }
      return lane().process(name, concurrencyOrHandler)
    },
    on,
    getJob(jobId) {
      return lane().getJob(scoped(jobId))
    },
    async getRepeatableJobs() {
      const all = await lane().getRepeatableJobs()
      return all.filter((job) => job.name === name)
    },
    removeRepeatableByKey(key) {
      return lane().removeRepeatableByKey(key)
    },
  }
  return logical
}
