import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'
import DriverRoute from './DriverRoute'
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
      { path: PATHS.REGISTER_ENTRY, element: page(() => import('@/pages/RegisterPage')) },
      { path: PATHS.REGISTER, element: page(() => import('@/pages/RegisterPage')) },
      { path: PATHS.OTP, element: page(() => import('@/pages/OtpPage')) },
      { path: PATHS.FORGOT_PASSWORD, element: page(() => import('@/pages/ForgotPasswordPage')) },
    ],
  },

  // Accessible to both authenticated (unverified) and unauthenticated users
  { path: PATHS.VERIFY_OTP, element: page(() => import('@/pages/OtpPage')) },

  // Public marketing page — viewable signed in or out
  { path: PATHS.ABOUT, element: page(() => import('@/pages/AboutPage')) },

  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <FeedLayout />,
        children: [
          { path: PATHS.FEED, element: page(() => import('@/pages/FeedPage')) },
          { path: PATHS.POST_DETAIL, element: page(() => import('@/pages/PostDetailPage')) },

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

          { path: PATHS.LEARN, element: page(() => import('@/pages/LearnPage')) },

          { path: PATHS.SHUTTLE, element: page(() => import('@/pages/ShuttlePage')) },

          { path: PATHS.EXPLORE, element: page(() => import('@/pages/ExplorePage')) },
          { path: PATHS.TAG, element: page(() => import('@/pages/TagPage')) },

          { path: PATHS.CONNECTIONS, element: page(() => import('@/pages/ConnectionsPage')) },

          { path: PATHS.DRAFTS, element: page(() => import('@/pages/DraftsPage')) },

          {
            path: PATHS.SETTINGS,
            element: page(() => import('@/pages/SettingsPage')),
            children: [
              { index: true, element: <Navigate to={PATHS.SETTINGS_NOTIFICATIONS} replace /> },
              {
                path: 'notifications',
                element: page(() => import('@/features/settings/components/NotificationsSection')),
              },
              {
                path: 'appearance',
                element: page(() => import('@/features/settings/components/AppearanceSection')),
              },
              {
                path: 'account',
                element: page(() => import('@/features/settings/components/AccountSection')),
              },
              {
                path: 'privacy',
                element: page(() => import('@/features/settings/components/PrivacySection')),
              },
            ],
          },
        ],
      },

      { path: PATHS.MESSAGES, element: page(() => import('@/pages/MessagesPage')) },
      { path: PATHS.CONVERSATION, element: page(() => import('@/pages/ConversationPage')) },

    ],
  },

  {
    element: <AdminRoute />,
    children: [
      { path: PATHS.ADMIN, element: page(() => import('@/pages/AdminPage')) },
    ],
  },

  {
    element: <DriverRoute />,
    children: [
      { path: PATHS.SHUTTLE_DRIVE, element: page(() => import('@/pages/ShuttleDrivePage')) },
    ],
  },

  { path: '*', element: page(() => import('@/pages/NotFoundPage')) },
])
