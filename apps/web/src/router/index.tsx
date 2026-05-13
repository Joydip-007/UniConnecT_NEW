import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import GuestRoute from './GuestRoute'
import { FeedLayout } from '@/components/FeedLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PATHS } from './paths'

function page(load: () => Promise<{ default: ComponentType }>) {
  const Comp = lazy(load)
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <Comp />
      </Suspense>
    </ErrorBoundary>
  )
}

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/', element: page(() => import('@/pages/LandingPage')) },
      { path: PATHS.LOGIN, element: page(() => import('@/pages/LoginPage')) },
      { path: PATHS.REGISTER, element: page(() => import('@/pages/RegisterPage')) },
      { path: PATHS.OTP, element: page(() => import('@/pages/OtpPage')) },
    ],
  },

  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <FeedLayout />,
        children: [
          { path: PATHS.FEED, element: page(() => import('@/pages/FeedPage')) },

          { path: PATHS.JOBS, element: page(() => import('@/pages/JobsPage')) },
          { path: PATHS.JOB_DETAIL, element: page(() => import('@/pages/JobDetailPage')) },

          { path: PATHS.EVENTS, element: page(() => import('@/pages/EventsPage')) },
          { path: PATHS.EVENT_DETAIL, element: page(() => import('@/pages/EventDetailPage')) },

          { path: PATHS.PROFILE, element: page(() => import('@/pages/ProfilePage')) },

          { path: PATHS.GROUPS, element: page(() => import('@/pages/GroupsPage')) },
          { path: PATHS.GROUP_DETAIL, element: page(() => import('@/pages/GroupDetailPage')) },

          { path: PATHS.NOTIFICATIONS, element: page(() => import('@/pages/NotificationsPage')) },

          { path: PATHS.NEWS, element: page(() => import('@/pages/NewsPage')) },
          { path: PATHS.NEWS_DETAIL, element: page(() => import('@/pages/NewsDetailPage')) },

          { path: PATHS.LOST_FOUND, element: page(() => import('@/pages/LostFoundPage')) },

          { path: PATHS.MENTORSHIP, element: page(() => import('@/pages/MentorshipPage')) },

          { path: PATHS.SHUTTLE, element: page(() => import('@/pages/ShuttlePage')) },

          { path: PATHS.SEARCH, element: page(() => import('@/pages/SearchPage')) },
        ],
      },

      { path: PATHS.MESSAGES, element: page(() => import('@/pages/MessagesPage')) },
      { path: PATHS.CONVERSATION, element: page(() => import('@/pages/ConversationPage')) },

      { path: PATHS.ADMIN, element: page(() => import('@/pages/AdminPage')) },
    ],
  },

  { path: '*', element: page(() => import('@/pages/NotFoundPage')) },
])
