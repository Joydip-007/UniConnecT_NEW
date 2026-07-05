import { useCallback, useState } from 'react'

const STORAGE_KEY = 'uc:left-sidebar-collapsed'

function readInitialPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writePreference(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    // Current-session state still updates when storage is unavailable.
  }
}

export function useSidebarRailPreference() {
  const [isCollapsed, setIsCollapsed] = useState(readInitialPreference)

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((current) => {
      const next = !current
      writePreference(next)
      return next
    })
  }, [])

  return { isCollapsed, toggleCollapsed }
}
