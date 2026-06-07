import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ContentSyncPanel } from './ContentSyncPanel'

// Control the data hooks so we can observe the save-before-sync ordering.
const { updateMutateAsync, triggerMutate, configData } = vi.hoisted(() => ({
  updateMutateAsync: vi.fn().mockResolvedValue({}),
  triggerMutate: vi.fn(),
  configData: {
    newsUrl: 'https://www.uiu.ac.bd/news/',
    noticeUrl: null,
    eventUrl: null,
    enabled: true,
    entriesPerSource: 5,
  },
}))

vi.mock('../hooks/useContentSync', () => ({
  useContentSyncConfig: () => ({ data: configData, isLoading: false }),
  useSyncRuns: () => ({ data: [] }),
  usePendingImported: () => ({ data: { news: [], events: [] } }),
  usePublishImported: () => ({ mutate: vi.fn(), isPending: false }),
  usePublishAllImported: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateContentSyncConfig: () => ({ mutate: vi.fn(), mutateAsync: updateMutateAsync, isPending: false }),
  useTriggerSync: () => ({ mutate: triggerMutate, isPending: false }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ContentSyncPanel — sync persists config first', () => {
  it('saves the current entries value before triggering a sync', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ContentSyncPanel />
      </MemoryRouter>,
    )

    const entries = screen.getByRole('spinbutton') // the "Entries per source" number input
    await user.clear(entries)
    await user.type(entries, '10')

    await user.click(screen.getByRole('button', { name: /sync now/i }))

    // The typed value must be persisted as part of the sync, not silently ignored.
    expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ entriesPerSource: 10 }))
    expect(triggerMutate).toHaveBeenCalledTimes(1)

    // And the save must happen before the run is triggered.
    const saveOrder = updateMutateAsync.mock.invocationCallOrder[0] ?? Infinity
    const triggerOrder = triggerMutate.mock.invocationCallOrder[0] ?? -Infinity
    expect(saveOrder).toBeLessThan(triggerOrder)
  })
})
