import { useLocation } from 'react-router-dom'
import type { BackLinkState } from '@/hooks/useBackLink'

/**
 * Router state for every link out of Explore: the detail page's back button returns
 * to this exact Explore URL — the carousels, a See-all view with its filter, or a
 * search with its tab — instead of that page's default (Feed, Groups, Events…).
 */
export function useExploreLinkState(): BackLinkState {
  const { pathname, search } = useLocation()
  return { from: { path: pathname + search, label: 'Back to explore' } }
}
