import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from './logger'

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redacts the args of a failed Redis command on an error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = Object.assign(new Error('ERR max number of clients reached'), {
      command: { name: 'auth', args: ['default', 'hunter2-redis-password'] },
    })

    logger.error('Redis failed', { error })

    const line = String(errorSpy.mock.calls[0][0])
    expect(line).not.toContain('hunter2-redis-password')
    expect(line).toContain('"name":"auth"')
    expect(line).toContain('[redacted]')
  })

  it('still copies other enumerable error properties', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = Object.assign(new Error('bad'), { code: 'E_BAD', statusCode: 400 })

    logger.error('failed', { error })

    const line = String(errorSpy.mock.calls[0][0])
    expect(line).toContain('"code":"E_BAD"')
    expect(line).toContain('"statusCode":400')
  })
})
