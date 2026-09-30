import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeRedisError, watchRedisClient } from './redis-errors'

const SECRET = 'hunter2-redis-password'

function replyError(message: string) {
  // Shape of an ioredis ReplyError: the failed command, including AUTH args, is an
  // enumerable own property, so a naive serialiser prints the password.
  return Object.assign(new Error(message), {
    name: 'ReplyError',
    command: { name: 'auth', args: ['default', SECRET] },
  })
}

describe('describeRedisError', () => {
  it('keeps the command name but never the args', () => {
    const described = describeRedisError(replyError('ERR max number of clients reached'))
    expect(described).toEqual({
      name: 'ReplyError',
      message: 'ERR max number of clients reached',
      command: 'auth',
    })
    expect(JSON.stringify(described)).not.toContain(SECRET)
  })

  it('handles non-Error values', () => {
    expect(describeRedisError('boom')).toEqual({ name: 'UnknownError', message: 'boom' })
  })
})

describe('watchRedisClient', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('turns an error event into a log line instead of an unhandled error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = new EventEmitter()
    watchRedisClient(client, 'test-client')

    // Without a listener this emit would throw ERR_UNHANDLED_ERROR and kill the process.
    expect(() => client.emit('error', replyError('ERR max number of clients reached'))).not.toThrow()

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const line = String(errorSpy.mock.calls[0][0])
    expect(line).toContain('test-client')
    expect(line).toContain('ERR max number of clients reached')
    expect(line).not.toContain(SECRET)
  })

  it('throttles a reconnect storm to one line per window, then reports the suppressed count', () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = new EventEmitter()
    watchRedisClient(client, 'storm', 30_000)

    for (let i = 0; i < 5; i += 1) client.emit('error', replyError('ECONNREFUSED'))
    expect(errorSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(30_001)
    client.emit('error', replyError('ECONNREFUSED'))
    expect(errorSpy).toHaveBeenCalledTimes(2)
    expect(String(errorSpy.mock.calls[1][0])).toContain('"suppressed":4')
  })
})
