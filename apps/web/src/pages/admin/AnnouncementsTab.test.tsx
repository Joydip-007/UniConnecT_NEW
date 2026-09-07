import { describe, it, expect } from 'vitest'
import { announcementStatus } from './AnnouncementsTab'

describe('announcementStatus', () => {
  it('returns published when isPublished is true', () => {
    expect(announcementStatus({ isPublished: true, publishAt: null })).toBe('published')
  })

  it('returns scheduled when unpublished with a future publishAt', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(announcementStatus({ isPublished: false, publishAt: future })).toBe('scheduled')
  })

  it('returns draft when unpublished with no publishAt', () => {
    expect(announcementStatus({ isPublished: false, publishAt: null })).toBe('draft')
  })

  it('returns draft when unpublished and publishAt has already passed (safety-net window)', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(announcementStatus({ isPublished: false, publishAt: past })).toBe('draft')
  })
})
