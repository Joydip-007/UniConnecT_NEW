import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePageRailStore, usePageRails } from './pageRailStore'

describe('pageRailStore', () => {
  beforeEach(() => {
    usePageRailStore.setState({ leftOverride: null, rightOverride: null })
  })

  it('setLeftOverride / setRightOverride update state directly', () => {
    usePageRailStore.getState().setLeftOverride('left')
    usePageRailStore.getState().setRightOverride('right')
    expect(usePageRailStore.getState().leftOverride).toBe('left')
    expect(usePageRailStore.getState().rightOverride).toBe('right')
  })

  describe('usePageRails', () => {
    it('sets both overrides on mount', () => {
      renderHook(() => usePageRails('left node', 'right node'))
      expect(usePageRailStore.getState().leftOverride).toBe('left node')
      expect(usePageRailStore.getState().rightOverride).toBe('right node')
    })

    it('clears both overrides on unmount', () => {
      const { unmount } = renderHook(() => usePageRails('left node', 'right node'))
      expect(usePageRailStore.getState().leftOverride).toBe('left node')
      unmount()
      expect(usePageRailStore.getState().leftOverride).toBeNull()
      expect(usePageRailStore.getState().rightOverride).toBeNull()
    })

    it('updates overrides when the passed nodes change', () => {
      const { rerender } = renderHook(({ left, right }) => usePageRails(left, right), {
        initialProps: { left: 'a' as ReactNode, right: 'b' as ReactNode },
      })
      expect(usePageRailStore.getState().leftOverride).toBe('a')
      rerender({ left: 'c', right: 'd' })
      expect(usePageRailStore.getState().leftOverride).toBe('c')
      expect(usePageRailStore.getState().rightOverride).toBe('d')
    })
  })
})
