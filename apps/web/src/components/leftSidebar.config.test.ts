import { describe, expect, it } from 'vitest'
import { activeRailIndex } from './leftSidebar.config'

describe('activeRailIndex', () => {
  it('gives a tool URL to the tool, not the bare row sharing its path', () => {
    const tos = ['/feed', '/explore', '/groups', '/explore?section=lost-found']
    expect(activeRailIndex(tos, '/explore', '?section=lost-found')).toBe(3)
    expect(activeRailIndex(tos, '/explore', '')).toBe(1)
  })

  it('lands a bare shared path on the first row', () => {
    const tos = ['/admin?tab=overview', '/admin?tab=users']
    expect(activeRailIndex(tos, '/admin', '')).toBe(0)
    expect(activeRailIndex(tos, '/admin', '?tab=users')).toBe(1)
  })

  it('never matches a null (external) destination', () => {
    expect(activeRailIndex([null, '/feed'], '/feed', '')).toBe(1)
    expect(activeRailIndex([null], '/', '')).toBe(-1)
  })
})
