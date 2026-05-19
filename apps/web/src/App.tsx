import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from '@/router'
import { GlobalCurtain } from '@/components/GlobalCurtain'
import { useThemeStore } from '@/stores/themeStore'

export default function App() {
  const resolved = useThemeStore((s) => s.resolved)
  return (
    <>
      <RouterProvider router={router} />
      <GlobalCurtain />
      <Toaster position="top-right" theme={resolved} richColors />
    </>
  )
}
