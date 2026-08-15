import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse, delay } from 'msw'
import { server } from '@/tests/msw/server'
import { AISettingsPanel } from './AISettingsPanel'

const GROUP_ID = 'group-1'
/**
 * Wildcard prefix, matching `tests/msw/handlers.ts`. The axios baseURL is built from
 * `VITE_API_URL`, which is unset under vitest — pinning an absolute origin here would
 * never match the request the client actually makes.
 */
const BASE = '*'

/** Mirrors the server: an atomic merge into the stored blob. */
let stored: Record<string, unknown>
/** Delay applied to the Nth PATCH, so we can land responses out of order. */
let patchDelays: number[]
let patchCount: number
/**
 * Delay applied to every GET after the initial load. Slowing the reconciling refetch
 * separates "the optimistic value was rolled back" from "the refetch happened to
 * correct it" — without this, a missing rollback is invisible.
 */
let refetchDelay: number
let getCount: number

function settingsResponse() {
  return {
    ai_flashcards_enabled: false,
    ai_quiz_enabled: false,
    require_approval: false,
    difficulty: 'intermediate',
    question_style: 'mcq',
    language: 'en',
    items_per_run: 10,
    frequency: 'daily',
    run_hour: 2,
    ...stored,
  }
}

beforeEach(() => {
  stored = {}
  patchDelays = []
  patchCount = 0
  refetchDelay = 0
  getCount = 0

  server.use(
    http.get(`${BASE}/groups/${GROUP_ID}/ai-settings`, async () => {
      if (getCount++ > 0 && refetchDelay) await delay(refetchDelay)
      return HttpResponse.json({ data: { aiSettings: settingsResponse() } })
    }),
    http.patch(`${BASE}/groups/${GROUP_ID}/ai-settings`, async ({ request }) => {
      const patch = (await request.json()) as Record<string, unknown>
      const ms = patchDelays[patchCount++] ?? 0
      if (ms) await delay(ms)
      // The merge lands when the write completes, not when it was issued — so a GET
      // that races an open PATCH still sees the pre-write blob, exactly as the server
      // does. Committing before the delay would hide the very overwrite these tests guard.
      stored = { ...stored, ...patch }
      return HttpResponse.json({ data: { aiSettings: settingsResponse() } })
    }),
    http.get(`${BASE}/groups/${GROUP_ID}/ai-settings/pending`, () => HttpResponse.json({ data: [] })),
    http.get(`${BASE}/groups/${GROUP_ID}/course-outline`, () => HttpResponse.json({ data: null })),
  )
})

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AISettingsPanel groupId={GROUP_ID} />
    </QueryClientProvider>,
  )
}

describe('AISettingsPanel — independent toggles', () => {
  it('keeps a toggle checked while its write is in flight', async () => {
    const user = userEvent.setup()
    patchDelays = [600]
    renderPanel()

    const quiz = await screen.findByLabelText('Daily quiz')
    await user.click(quiz)

    // Must not snap back to unchecked while the PATCH is still open.
    expect(quiz).toBeChecked()
    await waitFor(() => expect(quiz).toBeChecked())
  })

  it('does not switch off the first toggle when a second is clicked', async () => {
    const user = userEvent.setup()
    // The first write settles while the second is still open. If the first one's
    // completion triggers a refetch, that response predates the second write and
    // switches the second toggle back off — the original bug.
    patchDelays = [200, 1000]
    renderPanel()

    const quiz = await screen.findByLabelText('Daily quiz')
    const flashcards = await screen.findByLabelText('AI flashcards')

    await user.click(quiz)
    await user.click(flashcards)

    expect(quiz).toBeChecked()
    expect(flashcards).toBeChecked()

    // Point-in-time check inside the danger window: the first PATCH has resolved,
    // the second has not. A `waitFor` would mask this, since the value recovers
    // once the second write finally lands.
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(quiz).toBeChecked()
    expect(flashcards).toBeChecked()

    // Both must still be on once every write and the reconciling refetch settle.
    await waitFor(() =>
      expect(stored).toMatchObject({ ai_quiz_enabled: true, ai_flashcards_enabled: true }),
    )
    await waitFor(() => {
      expect(quiz).toBeChecked()
      expect(flashcards).toBeChecked()
    })
  })

  it('rolls a toggle back when the write fails', async () => {
    const user = userEvent.setup()
    // The reconciling refetch is held open, so the only thing that can uncheck the
    // box inside this window is the rollback itself.
    refetchDelay = 1500
    server.use(
      http.patch(`${BASE}/groups/${GROUP_ID}/ai-settings`, () =>
        HttpResponse.json({ error: 'nope', code: 'FORBIDDEN' }, { status: 403 }),
      ),
    )
    renderPanel()

    const quiz = await screen.findByLabelText('Daily quiz')
    await user.click(quiz)

    await waitFor(() => expect(quiz).not.toBeChecked(), { timeout: 400 })
  })
})
