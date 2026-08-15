import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RAILS } from '@/components/leftSidebar.config'
import { PATHS } from '@/router/paths'

/**
 * The admin rail deep-links into AdminPage via `?tab=`. Those values are a contract with
 * AdminPage's own `Tab` union — the mockups used different wording ("moderation",
 * "members", "insights"), and a drifted value silently lands on the default tab.
 * Parsed from source so renaming a tab in AdminPage fails here rather than in the UI.
 */
function adminTabValues(): string[] {
  const src = readFileSync(resolve(__dirname, '../pages/AdminPage.tsx'), 'utf8')
  const union = src.match(/^type Tab = (.+)$/m)
  if (!union) throw new Error('Could not find the Tab union in AdminPage.tsx')
  return [...union[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('admin rail deep links', () => {
  it('points every /admin row at a tab AdminPage actually defines', () => {
    const valid = adminTabValues()
    expect(valid.length).toBeGreaterThan(0)

    const adminRows = RAILS.admin.fixed.filter((row) => row.to.startsWith(PATHS.ADMIN))
    expect(adminRows.length).toBeGreaterThan(0)

    adminRows.forEach((row) => {
      const tab = new URLSearchParams(row.to.split('?')[1] ?? '').get('tab')
      expect({ row: row.key, tab, valid: tab !== null && valid.includes(tab) }).toEqual({
        row: row.key,
        tab,
        valid: true,
      })
    })
  })
})
