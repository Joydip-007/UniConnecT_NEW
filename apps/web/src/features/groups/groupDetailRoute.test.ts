import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GROUP_MODALS,
  GROUP_TABS,
  groupDetailPath,
  resolveGroupModal,
  resolveGroupTab,
} from './groupDetailRoute'

describe('resolveGroupTab', () => {
  const memberTabs = ['feed', 'resources', 'study-sessions', 'members', 'events', 'about']

  it('lands on the tab the URL names when the role earns it', () => {
    expect(resolveGroupTab('members', memberTabs)).toBe('members')
  })

  it('falls back to feed for a tab the role does not earn', () => {
    // A student following an admin's `?tab=stats` link must not see an empty panel.
    expect(resolveGroupTab('stats', memberTabs)).toBe('feed')
    expect(resolveGroupTab('join-requests', memberTabs)).toBe('feed')
  })

  it('falls back to feed for an unknown or absent tab', () => {
    expect(resolveGroupTab('settings', memberTabs)).toBe('feed')
    expect(resolveGroupTab(null, memberTabs)).toBe('feed')
  })
})

describe('resolveGroupModal', () => {
  it('opens share for anyone who can see the group', () => {
    expect(resolveGroupModal('share', ['share'])).toBe('share')
  })

  it('ignores invite when the viewer cannot invite', () => {
    expect(resolveGroupModal('invite', ['share'])).toBeNull()
  })

  it('ignores a modal that has no route', () => {
    // Booking, the moderation log and group chat have no endpoint yet, so no URL opens them.
    expect(resolveGroupModal('book', ['share', 'invite'])).toBeNull()
    expect(resolveGroupModal(null, ['share', 'invite'])).toBeNull()
  })
})

describe('groupDetailPath', () => {
  it('keeps the default tab and a closed modal out of the URL', () => {
    expect(groupDetailPath('g1')).toBe('/groups/g1')
    expect(groupDetailPath('g1', { tab: 'feed', modal: null })).toBe('/groups/g1')
  })

  it('writes a non-default tab and an open modal', () => {
    expect(groupDetailPath('g1', { tab: 'members' })).toBe('/groups/g1?tab=members')
    expect(groupDetailPath('g1', { modal: 'share' })).toBe('/groups/g1?modal=share')
    expect(groupDetailPath('g1', { tab: 'about', modal: 'invite' })).toBe('/groups/g1?tab=about&modal=invite')
  })
})

describe('route contract', () => {
  it('names every tab GroupDetailPage renders, and nothing else', () => {
    // The page's ActiveTab union is what actually gets a body; a tab in the URL
    // contract that the page never renders would land on nothing.
    const source = readFileSync(resolve(__dirname, '../../pages/GroupDetailPage.tsx'), 'utf8')
    const rendered = [...source.matchAll(/activeTab === '([a-z-]+)'/g)].map((m) => m[1])
    expect([...new Set(rendered)].sort()).toEqual([...GROUP_TABS].sort())
  })

  it('only routes modals the page mounts', () => {
    const source = readFileSync(resolve(__dirname, '../../pages/GroupDetailPage.tsx'), 'utf8')
    for (const modal of GROUP_MODALS) {
      expect(source).toContain(`modal === '${modal}'`)
    }
  })
})
