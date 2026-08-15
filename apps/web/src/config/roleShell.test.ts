import { describe, expect, it } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { ROLE_SHELL, type WidgetKey } from './roleShell'
import { RIGHT_RAIL_WIDGETS } from '@/components/rightRail'
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

  it('every rightRail key has a widget built for it', () => {
    ROLES.forEach((role) => {
      ROLE_SHELL[role].rightRail.forEach((key) => {
        expect(RIGHT_RAIL_WIDGETS[key], `${role} lists ${key} with no widget`).toBeDefined()
      })
    })
  })

  it('no role stacks more than four right-rail widgets', () => {
    ROLES.forEach((role) => {
      expect(ROLE_SHELL[role].rightRail.length).toBeLessThanOrEqual(4)
    })
  })

  it('no role lists the same widget twice', () => {
    ROLES.forEach((role) => {
      const keys = ROLE_SHELL[role].rightRail
      expect(new Set(keys).size).toBe(keys.length)
    })
  })

  it('keeps role-gated widgets to the roles whose API allows them', () => {
    // GET /mentorship/requests/incoming is requireRole('alumni','admin');
    // GET /admin/stats is requireRole('admin'). A widget on a role that would 403 is
    // exactly the "row that leads to a 403" the shell rule forbids.
    const gated: Record<string, UserRole[]> = {
      'mentee-requests': ['alumni', 'admin'],
      'platform-today': ['admin'],
    }
    ROLES.forEach((role) => {
      ROLE_SHELL[role].rightRail.forEach((key: WidgetKey) => {
        const allowed = gated[key]
        if (allowed) expect(allowed, `${role} may not render ${key}`).toContain(role)
      })
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
