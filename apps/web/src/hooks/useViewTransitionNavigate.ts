import { useNavigate } from 'react-router-dom'

/**
 * Plain navigation. The name is kept because three components and two test mocks
 * address the hook by it, and because this is the one place a page transition would
 * ever be reintroduced.
 *
 * It used to wrap `navigate` in `document.startViewTransition`, cross-fading the whole
 * document on every rail click, mobile-nav tap and post-card open. On an administrative
 * product that reads as the page hesitating: the reader has already decided where they
 * are going, and the fade puts a beat of stale content between the click and the answer.
 * Navigation is now immediate.
 *
 * The surface animations are deliberately untouched — the rail's sliding active pill,
 * the right rail's stagger, and the popover/modal/drawer presets in `lib/motion.ts` all
 * still run. Those are feedback for something the reader just did to one element, not
 * the whole page redrawing itself.
 */
export function useViewTransitionNavigate(): (to: string) => void {
  return useNavigate()
}
