import { describe, expect, it } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { PUBLIC_STAT, ROLE_SHELL, statsFor, type WidgetKey } from './roleShell'
import { RIGHT_RAIL_WIDGETS } from '@/components/rightRail'
import { RAILS } from '@/components/leftSidebar.config'
import { PATHS } from '@/router/paths'

const ROLES: UserRole[] = ['student', 'alumni', 'faculty', 'admin', 'driver']
/** The driver is a service account walled off from the social shell, so it opts out. */
const MEMBER_ROLES: UserRole[] = ['student', 'alumni', 'faculty', 'admin']
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
    // The admin console widgets read `/admin/*` endpoints that 403 for every other role.
    // A widget on a role that would 403 is the "row that leads to a 403" the shell rule
    // forbids.
    const gated: Record<string, UserRole[]> = {
      'admin-queue': ['admin'],
      'admin-stats': ['admin'],
    }
    ROLES.forEach((role) => {
      ROLE_SHELL[role].rightRail.forEach((key: WidgetKey) => {
        const allowed = gated[key]
        if (allowed) expect(allowed, `${role} may not render ${key}`).toContain(role)
      })
    })
  })

  it('gives every social role the same number of widgets', () => {
    // The three social roles should not differ in rail *length* — only in payload.
    // profile-progress self-retires once a student's profile is complete, so the
    // steady state is four keys each, with each widget hiding itself when empty.
    // Admin is excluded: its rail is the console pair, not the suggestion set.
    const counts = MEMBER_ROLES.filter((r) => r !== 'admin').map((role) => ROLE_SHELL[role].rightRail.length)
    expect(new Set(counts).size, `member rails differ in length: ${counts.join(', ')}`).toBe(1)
  })

  it('gives admin exactly the console pair and no member widget', () => {
    // An admin is walled out of the feed, so events, people and tags would be payload
    // for a surface it cannot reach. The queue and the scoreboard are the whole rail.
    expect(ROLE_SHELL.admin.rightRail).toEqual(['admin-queue', 'admin-stats'])
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

  it('every fixed, secondary and tool "to" is a value in PATHS', () => {
    ROLES.forEach((role) => {
      const rail = RAILS[role]
      // `secondary` carries 11 of admin's rows and is the only zone reachable solely
      // through the avatar menu and the mobile More sheet, so a typo there is invisible.
      ;[...rail.fixed, ...rail.secondary].forEach((row) => {
        expect(PATH_VALUES.has(stripQuery(row.to) as (typeof PATHS)[keyof typeof PATHS])).toBe(true)
      })
      rail.contextual.forEach((rule) => {
        expect(PATH_VALUES.has(stripQuery(rule.to) as (typeof PATHS)[keyof typeof PATHS])).toBe(true)
      })
      rail.tools.forEach((tool) => {
        // Tools deep-link with `?tab=`/`?section=` like rows do, so the query is stripped
        // here as it is everywhere else — the tab itself is checked in adminTabs.test.ts.
        if (tool.to) expect(PATH_VALUES.has(stripQuery(tool.to) as (typeof PATHS)[keyof typeof PATHS])).toBe(true)
        else expect(tool.externalUrl).toBeTruthy()
      })
    })
  })

  // Admin is the one role allowed a sixth row: it has no Feed row at all, so every
  // fixed row is an admin surface and the cap buys nothing by pushing one into tools.
  it('no role has more than 5 fixed rows (admin: 6)', () => {
    ROLES.forEach((role) => {
      expect(RAILS[role].fixed.length).toBeLessThanOrEqual(role === 'admin' ? 6 : 5)
    })
  })

  it('never lists the same destination in both fixed and secondary', () => {
    // The mobile More sheet dedupes by path, so a row in both zones would simply vanish
    // from one of them rather than render twice — silently, and only on mobile.
    ROLES.forEach((role) => {
      const fixed = new Set(RAILS[role].fixed.map((row) => row.to))
      RAILS[role].secondary.forEach((row) => {
        expect(fixed.has(row.to), `${role} lists ${row.to} in both zones`).toBe(false)
      })
    })
  })

  it('never gives a tool tile a destination the rail already offers', () => {
    // A tool is either an external campus utility or somewhere no row goes. Pointing a
    // tile at a row's destination is that row under a second name — which is how the
    // driver ended up with seven entries resolving to two routes.
    ROLES.forEach((role) => {
      const rail = RAILS[role]
      const rows = new Set([...rail.fixed, ...rail.secondary].map((row) => row.to))
      rail.tools.forEach((tool) => {
        if (!tool.to) return
        expect(rows.has(tool.to), `${role}'s ${tool.key} tile repeats a rail row`).toBe(false)
      })
    })
  })

  it('driver has exactly 4 fixed rows and no feed/composer routes', () => {
    expect(RAILS.driver.fixed.length).toBe(4)
    const to = RAILS.driver.fixed.map((r) => r.to)
    expect(to).not.toContain(PATHS.FEED)
  })
})

describe('ROLE_SHELL stats pair', () => {
  it('gives every role exactly two stats', () => {
    ROLES.forEach((role) => {
      expect(ROLE_SHELL[role].stats).toHaveLength(2)
    })
  })

  it('never shows the same number twice in a pair', () => {
    ROLES.forEach((role) => {
      const [a, b] = ROLE_SHELL[role].stats
      expect(a.key, `${role} shows ${a.key} twice`).not.toBe(b.key)
    })
  })

  it('keeps role-scoped counts on the roles the API computes them for', () => {
    // countRoleStats in users/service.ts only fills these in for the matching role, so
    // asking for one elsewhere would render a silent zero.
    const scoped: Record<string, UserRole> = {
      mentees: 'alumni',
      sections: 'faculty',
      students: 'faculty',
      members: 'admin',
      groups: 'admin',
    }
    ROLES.forEach((role) => {
      ROLE_SHELL[role].stats.forEach(({ key }) => {
        const owner = scoped[key]
        if (owner) expect(owner, `${role} asks for ${key}`).toBe(role)
      })
    })
  })

  it('swaps owner-only stats for a public one when a visitor is looking', () => {
    // pendingReceived is returned as 0 for anyone but the owner, so a visitor must
    // never see it — they would read a permanent zero as "no pending requests".
    const own = statsFor('student', true)
    const visiting = statsFor('student', false)

    expect(own[1].key).toBe('pendingReceived')
    expect(visiting[1]).toEqual(PUBLIC_STAT)
    expect(visiting[0]).toEqual(own[0])
  })

  it('leaves pairs without owner-only entries untouched for visitors', () => {
    expect(statsFor('faculty', false)).toEqual(statsFor('faculty', true))
    expect(statsFor('alumni', false)).toEqual(statsFor('alumni', true))
  })
})
