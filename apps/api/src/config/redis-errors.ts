import { logger } from '../utils/logger'

/** Anything that emits ioredis-style `error` events (a Redis client or a Bull queue). */
interface ErrorEmitter {
  on(event: 'error', listener: (error: unknown) => void): unknown
}

const DEFAULT_THROTTLE_MS = 30_000

/**
 * The safe subset of a Redis error: never the command args, which for AUTH carry
 * the password.
 */
export function describeRedisError(error: unknown): { name: string; message: string; command?: string } {
  if (!(error instanceof Error)) return { name: 'UnknownError', message: String(error) }
  const command = (error as { command?: { name?: unknown } }).command
  return {
    name: error.name,
    message: error.message,
    ...(typeof command?.name === 'string' && { command: command.name }),
  }
}

/**
 * Give a Redis client (or Bull queue) an `error` listener. With none, Node throws
 * ERR_UNHANDLED_ERROR on the first emit and the process exits, which is how a
 * restart that hit Redis's connection cap took the whole API down.
 *
 * ioredis keeps reconnecting on its own, so the error is only logged, at most once
 * per throttle window per client, with the number of errors swallowed since the
 * last line.
 */
export function watchRedisClient(client: ErrorEmitter, label: string, throttleMs = DEFAULT_THROTTLE_MS): void {
  let lastLoggedAt = Number.NEGATIVE_INFINITY
  let suppressed = 0

  client.on('error', (error) => {
    const now = Date.now()
    if (now - lastLoggedAt < throttleMs) {
      suppressed += 1
      return
    }
    logger.error('Redis client error', { client: label, suppressed, ...describeRedisError(error) })
    lastLoggedAt = now
    suppressed = 0
  })
}
