import { PeopleYouMayKnowWidget } from '@/components/rightRail/PeopleYouMayKnowWidget'
import { ProfileProgressWidget } from '@/components/rightRail/ProfileProgressWidget'
import { UpcomingEventsWidget } from '@/components/rightRail/UpcomingEventsWidget'
import { LearnStreakCard } from './LearnStreakCard'

/**
 * The Learn page's right rail: progress, the streak card, then the member discovery widgets.
 *
 * Progress and the streak card share the first slot on purpose. Rail chrome is positional
 * (`.right-rail > *:first-child` is the card, `:nth-child(n + 3)` gets a hairline), so
 * grouping them keeps "People you may know" flush and puts the rule above "Upcoming events",
 * as the design draws it.
 */
export function LearnRightRail() {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <ProfileProgressWidget />
        <LearnStreakCard variant="rail" />
      </div>
      <PeopleYouMayKnowWidget />
      <UpcomingEventsWidget />
    </>
  )
}
