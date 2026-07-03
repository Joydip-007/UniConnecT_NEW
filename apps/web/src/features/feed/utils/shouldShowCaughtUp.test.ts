import { describe, expect, it } from 'vitest'
import { shouldShowCaughtUp } from './shouldShowCaughtUp'

const base = {
  isLoading: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  postCount: 1,
}

describe('shouldShowCaughtUp', () => {
  it('shows when settled, no next page, and at least one post', () => {
    expect(shouldShowCaughtUp(base)).toBe(true)
  })

  it('hides while the initial page is loading', () => {
    expect(shouldShowCaughtUp({ ...base, isLoading: true })).toBe(false)
  })

  it('hides while fetching the next page', () => {
    expect(shouldShowCaughtUp({ ...base, isFetchingNextPage: true })).toBe(false)
  })

  it('hides when another page is still available', () => {
    expect(shouldShowCaughtUp({ ...base, hasNextPage: true })).toBe(false)
  })

  it('shows when hasNextPage is undefined, same as false (falsy)', () => {
    expect(shouldShowCaughtUp({ ...base, hasNextPage: undefined })).toBe(true)
  })

  it('hides when there are no posts', () => {
    expect(shouldShowCaughtUp({ ...base, postCount: 0 })).toBe(false)
  })
})
