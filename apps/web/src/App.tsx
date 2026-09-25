import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react'
import { router } from '@/router'
import { GlobalCurtain } from '@/components/GlobalCurtain'
import { RedirectNoticeHost } from '@/components/RedirectNoticeHost'
import { useThemeStore } from '@/stores/themeStore'

// Feedback toasts per the Notification Overlays design: tinted mint/red cards at the
// top right, 32px below the nav (16px inset on a phone). Styling lives in index.css.
const toastIcons = {
  success: <CircleCheck size={18} strokeWidth={1.5} />,
  error: <CircleX size={18} strokeWidth={1.5} />,
  info: <Info size={18} strokeWidth={1.5} />,
  warning: <TriangleAlert size={18} strokeWidth={1.5} />,
}

export default function App() {
  const resolved = useThemeStore((s) => s.resolved)
  return (
    <>
      <RouterProvider router={router} />
      <GlobalCurtain />
      <RedirectNoticeHost />
      <Toaster
        position="top-right"
        theme={resolved}
        offset={{ top: 92, right: 32 }}
        mobileOffset={{ top: 76, left: 16, right: 16 }}
        gap={8}
        expand
        icons={toastIcons}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: 'uc-toast',
            icon: 'uc-toast-icon',
            content: 'uc-toast-content',
            title: 'uc-toast-title',
            description: 'uc-toast-description',
            actionButton: 'uc-toast-action',
            cancelButton: 'uc-toast-cancel',
          },
        }}
      />
    </>
  )
}
