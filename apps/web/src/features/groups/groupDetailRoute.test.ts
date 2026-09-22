import { describe, expect, it } from 'vitest'
import { allowedModalsFor, resolveGroupModal } from './groupDetailRoute'

describe('resolveGroupModal', () => {
  it('opens share and members for anyone who can see the group', () => {
    expect(resolveGroupModal('share', ['share', 'members'])).toBe('share')
    expect(resolveGroupModal('members', ['share', 'members'])).toBe('members')
  })

  it('ignores invite when the viewer cannot invite', () => {
    // A member following an admin's `?modal=invite` link must not see a panel that 403s on send.
    expect(resolveGroupModal('invite', ['share', 'members'])).toBeNull()
  })

  it('ignores a modal that has no route', () => {
    // Booking and the moderation log have no overlay yet, so no URL opens them.
    expect(resolveGroupModal('book', ['share', 'members', 'invite'])).toBeNull()
    expect(resolveGroupModal(null, ['share', 'members', 'invite'])).toBeNull()
  })
})

describe('allowedModalsFor', () => {
  it('grants invite to owners and admins of non-system groups only', () => {
    expect(allowedModalsFor({ userRole: 'owner', isSystem: false })).toContain('invite')
    expect(allowedModalsFor({ userRole: 'admin', isSystem: false })).toContain('invite')
    expect(allowedModalsFor({ userRole: 'moderator', isSystem: false })).not.toContain('invite')
    expect(allowedModalsFor({ userRole: 'member', isSystem: false })).not.toContain('invite')
    expect(allowedModalsFor({ userRole: 'admin', isSystem: true })).not.toContain('invite')
    expect(allowedModalsFor({ userRole: null, isSystem: false })).toEqual(['share', 'members'])
  })
})
