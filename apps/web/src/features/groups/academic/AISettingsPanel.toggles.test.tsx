import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse, delay } from 'msw'
import { server } from '@/tests/msw/server'
import { AISettingsPanel } from './AISettingsPanel'

const GROUP_ID = 'group-1'
const BASE = 'http://localhost:3001/api/v1'

/** Mirrors the server: an atomic merge into the stored blob. */
let stored: Record<string, unknown>
/** Delay applied to the Nth PATCH, so we can land responses out of order. */
let patchDelays: number[]
let patchCount: number

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

  server.use(
    http.get(`${BASE}/groups/${GROUP_ID}/ai-settings`, () =>
      HttpResponse.json({ data: { aiSettings: settingsResponse() } }),
    ),
    http.patch(`${BASE}/groups/${GROUP_ID}/ai-settings`, async ({ request }) => {
      const patch = (await request.json()) as Record<string, unknown>
      // The write commits immediately, as the SQL `||` merge does.
      stored = { ...stored, ...patch }
      const ms = patchDelays[patchCount++] ?? 0
      if (ms) await delay(ms)
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
    // Both writes stay open across both clicks, so the assertions below land while
    // the first toggle is still unconfirmed — the moment it used to revert.
    patchDelays = [600, 600]
    renderPanel()

    const quiz = await screen.findByLabelText('Daily quiz')
    const flashcards = await screen.findByLabelText('AI flashcards')

    await user.click(quiz)
    await user.click(flashcards)

    expect(quiz).toBeChecked()
    expect(flashcards).toBeChecked()

    // Both must still be on once every write and the reconciling refetch settle.
    await waitFor(() => {
      expect(quiz).toBeChecked()
      expect(flashcards).toBeChecked()
    })
    expect(stored).toMatchObject({ ai_quiz_enabled: true, ai_flashcards_enabled: true })
  })

  it('rolls a toggle back when the write fails', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch(`${BASE}/groups/${GROUP_ID}/ai-settings`, () =>
        HttpResponse.json({ error: 'nope', code: 'FORBIDDEN' }, { status: 403 }),
      ),
    )
    renderPanel()

    const quiz = await screen.findByLabelText('Daily quiz')
    await user.click(quiz)

    await waitFor(() => expect(quiz).not.toBeChecked())
  })
})
