import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Where a detail page's back button should return to, and what it should say. */
export interface BackTarget {
  path: string
  label: string
}

/** The router `state` shape a list page passes on its links to a detail page. */
export interface BackLinkState {
  from?: BackTarget
}

/**
 * Back button for a detail page. A page that links here can pass `{ from }` in the
 * router state (Explore does, with its exact URL so a See-all view or a search comes
 * back intact); otherwise the page's own `fallback` applies.
 *
 * With `preferHistory`, a page reached without `{ from }` keeps going back through the
 * browser history (so a filtered list it came from survives).
 *
 * The origin is captured once, at mount: a detail page that rewrites its own query
 * (`?tab=`, `?modal=`) navigates without that state, and must still remember it.
 */
export function useBackLink(fallback: BackTarget, options: { preferHistory?: boolean } = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [from] = useState<BackTarget | undefined>(() => (location.state as BackLinkState | null)?.from)
  const target = from ?? fallback

  return {
    label: target.label,
    goBack: () => {
      // `preferHistory` keeps a page's old "browser back" behaviour when nothing passed
      // an origin; `location.key === 'default'` is a first entry, where -1 leaves the app.
      if (!from && options.preferHistory && location.key !== 'default') navigate(-1)
      else navigate(target.path)
    },
  }
}
