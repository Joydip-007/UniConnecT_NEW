import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleUnhandledRejection } from './process-handlers'

describe('handleUnhandledRejection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs the rejection with Redis args redacted instead of letting the process die', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reason = Object.assign(new Error('ERR max number of clients reached'), {
      name: 'ReplyError',
      command: { name: 'auth', args: ['default', 'hunter2-redis-password'] },
    })

    expect(() => handleUnhandledRejection(reason)).not.toThrow()

    const line = String(errorSpy.mock.calls[0][0])
    expect(line).toContain('Unhandled promise rejection')
    expect(line).toContain('ERR max number of clients reached')
    expect(line).not.toContain('hunter2-redis-password')
  })
})
