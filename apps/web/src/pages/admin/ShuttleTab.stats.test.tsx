import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { ShuttleTab } from './ShuttleTab'

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('ShuttleTab ops dashboard', () => {
  it('renders the 4 fleet stat tiles from the stats endpoint', async () => {
    server.use(
      http.get('*/shuttle/routes', () => HttpResponse.json({ data: [] })),
      http.get('*/admin/shuttle/stats', () =>
        HttpResponse.json({
          data: { busesLive: 1, activeRoutes: 3, onDutyDrivers: 5, onTimeRatePct: 92, routes: [] },
        }),
      ),
      http.get('*/admin/shuttle/settings', () =>
        HttpResponse.json({
          data: { liveGpsEnabled: true, riderEtaEnabled: true, autoAssignEnabled: false, serviceAlertsEnabled: true },
        }),
      ),
    )

    renderWithClient(<ShuttleTab />)

    expect(screen.getByText('Buses live')).toBeInTheDocument()
    expect(screen.getByText('Active routes')).toBeInTheDocument()
    expect(screen.getByText('On-duty drivers')).toBeInTheDocument()
    expect(screen.getByText('On-time rate')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('92%')).toBeInTheDocument())
  })

  it('shows a not-enough-data message when onTimeRatePct is null', async () => {
    server.use(
      http.get('*/shuttle/routes', () => HttpResponse.json({ data: [] })),
      http.get('*/admin/shuttle/stats', () =>
        HttpResponse.json({
          data: { busesLive: 0, activeRoutes: 1, onDutyDrivers: 0, onTimeRatePct: null, routes: [] },
        }),
      ),
      http.get('*/admin/shuttle/settings', () =>
        HttpResponse.json({
          data: { liveGpsEnabled: true, riderEtaEnabled: true, autoAssignEnabled: false, serviceAlertsEnabled: true },
        }),
      ),
    )

    renderWithClient(<ShuttleTab />)

    await waitFor(() => expect(screen.getByText('Not enough data yet')).toBeInTheDocument())
  })
})
