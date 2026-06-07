import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ContentSyncConfig } from '@uniconnect/shared'

// Mock the Skyvern client so we can observe whether the (expensive) browser
// fallback is invoked. The whole point of the fix: a healthy-WordPress tenant
// must NEVER reach Skyvern on a transient failure.
const { triggerWorkflow, pollRun, isSkyvernConfigured } = vi.hoisted(() => ({
  triggerWorkflow: vi.fn(),
  pollRun: vi.fn(),
  isSkyvernConfigured: vi.fn(),
}))
vi.mock('./skyvern.service', () => ({ triggerWorkflow, pollRun, isSkyvernConfigured }))

import { fetchContentItems } from './content-source.service'

const NEWS_URL = 'https://www.uiu.ac.bd/news/'
const config: ContentSyncConfig = { newsUrl: NEWS_URL, noticeUrl: null, eventUrl: null, enabled: true }

// Tiny knobs so tests are fast and deterministic (no real backoff waits).
const fastOpts = { retries: 2, retryDelayMs: 0, timeoutMs: 50 }

function wpItem(link = 'https://www.uiu.ac.bd/news/post-1/') {
  return { link, title: { rendered: 'Hello' }, content: { rendered: '<p>Body text</p>' }, date: '2026-06-01T10:00:00' }
}

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Skyvern is configured in every test — so if the fallback fires, it is a real
  // routing bug, not just a "not configured" skip.
  isSkyvernConfigured.mockReturnValue(true)
  triggerWorkflow.mockResolvedValue('run-1')
  pollRun.mockResolvedValue({ details_output: [] })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchContentItems — WordPress routing resilience', () => {
  it('uses the WordPress REST items on first success without retrying or calling Skyvern', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonOk([wpItem()]))
    vi.stubGlobal('fetch', fetchMock)

    const grouped = await fetchContentItems(config, [], fastOpts)

    expect(grouped.news).toHaveLength(1)
    expect(grouped.news[0]?.sourceUrl).toBe('https://www.uiu.ac.bd/news/post-1/')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(triggerWorkflow).not.toHaveBeenCalled()
  })

  it('retries the WordPress probe on a transient 503 and uses the recovered items (no Skyvern)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('upstream error', { status: 503 }))
      .mockResolvedValueOnce(jsonOk([wpItem()]))
    vi.stubGlobal('fetch', fetchMock)

    const grouped = await fetchContentItems(config, [], fastOpts)

    expect(grouped.news).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(triggerWorkflow).not.toHaveBeenCalled()
  })

  it('does NOT escalate to Skyvern when a WordPress site has a persistent transient failure (5xx)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('upstream error', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const grouped = await fetchContentItems(config, [], fastOpts)

    expect(grouped.news).toEqual([])
    expect(triggerWorkflow).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
  })

  it('treats a fetch network error as transient and does not escalate to Skyvern', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    vi.stubGlobal('fetch', fetchMock)

    const grouped = await fetchContentItems(config, [], fastOpts)

    expect(grouped.news).toEqual([])
    expect(triggerWorkflow).not.toHaveBeenCalled()
  })

  it('aborts a hanging WordPress request after the timeout and does not escalate to Skyvern', async () => {
    // fetch never resolves on its own — it only rejects when our AbortController fires.
    const fetchMock = vi.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const grouped = await fetchContentItems(config, [], { retries: 1, retryDelayMs: 0, timeoutMs: 20 })

    expect(grouped.news).toEqual([])
    expect(triggerWorkflow).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalled()
  })

  it('falls back to Skyvern only when the site is genuinely not WordPress (404 rest_no_route)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: 'rest_no_route' }), { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchContentItems(config, [], fastOpts)

    expect(triggerWorkflow).toHaveBeenCalledTimes(1)
    expect(triggerWorkflow).toHaveBeenCalledWith({ listUrl: NEWS_URL, knownSourceUrls: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1) // a definitive 404 is not retried
  })
})
