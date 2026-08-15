import type { ComponentType } from 'react'
import type { WidgetKey } from '@/config/roleShell'
import { MenteeRequestsWidget } from './MenteeRequestsWidget'
import { PeopleYouMayKnowWidget } from './PeopleYouMayKnowWidget'
import { PlatformTodayWidget } from './PlatformTodayWidget'
import { ProfileProgressWidget } from './ProfileProgressWidget'
import { TrendingTagsWidget } from './TrendingTagsWidget'
import { UpcomingEventsWidget } from './UpcomingEventsWidget'

/**
 * The one place a `WidgetKey` becomes a component. Typing it as a total
 * `Record<WidgetKey, …>` means adding a key to the manifest without building its widget
 * is a compile error rather than a blank rail.
 */
export const RIGHT_RAIL_WIDGETS: Record<WidgetKey, ComponentType> = {
  'profile-progress': ProfileProgressWidget,
  'people-you-may-know': PeopleYouMayKnowWidget,
  'upcoming-events': UpcomingEventsWidget,
  'mentee-requests': MenteeRequestsWidget,
  'platform-today': PlatformTodayWidget,
  'trending-tags': TrendingTagsWidget,
}
