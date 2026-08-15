import { describe, expect, it } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { ROLE_SHELL } from './roleShell'
import { RAILS } from '@/components/leftSidebar.config'
import { PATHS } from '@/router/paths'

const ROLES: UserRole[] = ['student', 'alumni', 'faculty', 'admin', 'driver']
const PATH_VALUES = new Set(Object.values(PATHS))

function stripQuery(to: string): string {
  return to.split('?')[0]
}

describe('ROLE_SHELL', () => {
  it('has an entry for every UserRole', () => {
    ROLES.forEach((role) => {
      expect(ROLE_SHELL[role]).toBeDefined()
    })
  })

  it('every primaryAction.to resolves to a route in PATHS', () => {
    ROLES.forEach((role) => {
      expect(PATH_VALUES.has(stripQuery(ROLE_SHELL[role].primaryAction.to) as (typeof PATHS)[keyof typeof PATHS])).toBe(true)
    })
  })

  it('every home resolves to a route in PATHS', () => {
    ROLES.forEach((role) => {
      expect(PATH_VALUES.has(stripQuery(ROLE_SHELL[role].home) as (typeof PATHS)[keyof typeof PATHS])).toBe(true)
    })
  })
})

describe('RAILS', () => {
  it('has an entry for every UserRole', () => {
    ROLES.forEach((role) => {
      expect(RAILS[role]).toBeDefined()
    })
  })

  it('every fixed and tool "to" is a value in PATHS', () => {
    ROLES.forEach((role) => {
      const rail = RAILS[role]
      rail.fixed.forEach((row) => {
        expect(PATH_VALUES.has(stripQuery(row.to) as (typeof PATHS)[keyof typeof PATHS])).toBe(true)
      })
      rail.contextual.forEach((rule) => {
        expect(PATH_VALUES.has(stripQuery(rule.to) as (typeof PATHS)[keyof typeof PATHS])).toBe(true)
      })
      rail.tools.forEach((tool) => {
        if (tool.to) expect(PATH_VALUES.has(tool.to as (typeof PATHS)[keyof typeof PATHS])).toBe(true)
        else expect(tool.externalUrl).toBeTruthy()
      })
    })
  })

  it('no role has more than 5 fixed rows', () => {
    ROLES.forEach((role) => {
      expect(RAILS[role].fixed.length).toBeLessThanOrEqual(5)
    })
  })

  it('driver has exactly 4 fixed rows and no feed/composer routes', () => {
    expect(RAILS.driver.fixed.length).toBe(4)
    const to = RAILS.driver.fixed.map((r) => r.to)
    expect(to).not.toContain(PATHS.FEED)
  })
})
