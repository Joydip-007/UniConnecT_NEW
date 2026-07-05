import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSidebarRailPreference } from './useSidebarRailPreference'

const STORAGE_KEY = 'uc:left-sidebar-collapsed'

describe('useSidebarRailPreference', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to expanded when storage is empty', () => {
    const { result } = renderHook(() => useSidebarRailPreference())
    expect(result.current.isCollapsed).toBe(false)
  })

  it('initializes collapsed from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    const { result } = renderHook(() => useSidebarRailPreference())
    expect(result.current.isCollapsed).toBe(true)
  })

  it('toggles and persists the collapsed value', () => {
    const { result } = renderHook(() => useSidebarRailPreference())

    act(() => result.current.toggleCollapsed())
    expect(result.current.isCollapsed).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')

    act(() => result.current.toggleCollapsed())
    expect(result.current.isCollapsed).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
  })
})
