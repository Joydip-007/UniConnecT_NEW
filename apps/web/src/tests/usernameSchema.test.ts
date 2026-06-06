import { describe, expect, it } from 'vitest'
import { normalizeUsername, RESERVED_USERNAMES, usernameSchema } from '@uniconnect/shared'

function ok(input: string) {
  return usernameSchema.safeParse(input).success
}

describe('usernameSchema', () => {
  it('accepts simple valid handles', () => {
    expect(ok('johndoe')).toBe(true)
    expect(ok('jane_doe')).toBe(true)
    expect(ok('a.b.c')).toBe(true)
    expect(ok('user123')).toBe(true)
  })

  it('lowercases and trims before validating', () => {
    const parsed = usernameSchema.safeParse('  JohnDoe  ')
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe('johndoe')
  })

  it('enforces length bounds (3–30)', () => {
    expect(ok('ab')).toBe(false)
    expect(ok('abc')).toBe(true)
    expect(ok('a'.repeat(30))).toBe(true)
    expect(ok('a'.repeat(31))).toBe(false)
  })

  it('rejects leading/trailing separators', () => {
    expect(ok('_john')).toBe(false)
    expect(ok('john_')).toBe(false)
    expect(ok('.john')).toBe(false)
    expect(ok('john.')).toBe(false)
  })

  it('rejects consecutive separators', () => {
    expect(ok('john__doe')).toBe(false)
    expect(ok('john..doe')).toBe(false)
    expect(ok('john._doe')).toBe(false)
  })

  it('rejects disallowed characters', () => {
    expect(ok('john doe')).toBe(false)
    expect(ok('john-doe')).toBe(false)
    expect(ok('john@doe')).toBe(false)
    expect(ok('josé')).toBe(false)
  })

  it('rejects reserved usernames', () => {
    for (const reserved of RESERVED_USERNAMES) {
      expect(ok(reserved)).toBe(false)
    }
  })
})

describe('normalizeUsername', () => {
  it('lowercases and trims', () => {
    expect(normalizeUsername('  JohnDoe ')).toBe('johndoe')
  })
})
