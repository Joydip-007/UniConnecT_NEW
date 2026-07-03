import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/queryClient'
import { AuthLoader } from '@/components/AuthLoader'
import RootErrorBoundary from '@/components/ErrorBoundary'
import './styles/index.css'
import App from './App'

// DEV-only: when running the design-verification flow (?dev-auth=1) without a
// backend, stub the read endpoints so data pages render real UI for screenshots.
const isScreenshotMode =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev-auth') === '1'
if (isScreenshotMode) {
  const { installDevMocks } = await import('@/lib/devMocks')
  installDevMocks()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthLoader>
          <App />
        </AuthLoader>
        {/* Suppressed in screenshot mode — its floating toggle button (bottom-right)
            otherwise gets captured in design-verification screenshots. */}
        {import.meta.env.DEV && !isScreenshotMode && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </RootErrorBoundary>
  </StrictMode>,
)
