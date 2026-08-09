import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGenerateContent } = vi.hoisted(() => {
  const fn = vi.fn()
  return { mockGenerateContent: fn }
})

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
      }
    }
  },
}))

import { generateQuizQuestions, MODEL_FALLBACK_CHAIN, RETRY_DELAYS_MS } from './ai.service'

describe('ai.service', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Drives a call that will sit on the retry backoff (RETRY_DELAYS_MS totals 6s per model)
   * without sleeping for real. Timers are faked only for the retrying tests so the happy
   * paths keep exercising ordinary async scheduling.
   */
  async function runWithoutBackoffDelays<T>(start: () => Promise<T>): Promise<T> {
    vi.useFakeTimers()
    const promise = start()
    // The call can reject while timers are still draining, which is before the caller
    // gets a chance to attach its own handler — mark it handled so that window doesn't
    // surface as an unhandled rejection. The caller still sees the original outcome.
    promise.catch(() => {})
    // Settles every pending backoff timer, re-checking after each one so the timers
    // scheduled by later retries are drained too.
    await vi.runAllTimersAsync()
    return promise
  }

  it('parses a valid JSON response into AIQuizQuestion[]', async () => {
    const payload = [
      { q: 'What is 2+2?', options: ['3', '4', '5', '6'], answer: 1, explanation: 'basic arithmetic' },
    ]
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(payload) },
    })

    const result = await generateQuizQuestions({ department: 'Computer Science', count: 1 })

    expect(result).toEqual(payload)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('retries once on failure then succeeds', async () => {
    const payload = [{ q: 'Q', options: ['a', 'b', 'c', 'd'], answer: 0 }]
    mockGenerateContent
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(payload) } })

    const result = await runWithoutBackoffDelays(() =>
      generateQuizQuestions({ department: 'Math', count: 1 }),
    )

    expect(result).toEqual(payload)
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries', async () => {
    mockGenerateContent.mockRejectedValue(new Error('persistent failure'))

    await expect(
      runWithoutBackoffDelays(() => generateQuizQuestions({ department: 'Math', count: 1 })),
    ).rejects.toThrow('persistent failure')
    // A non-quota error exhausts every retry on a model before falling through to the
    // next one in the chain, so the total is models × attempts-per-model.
    expect(mockGenerateContent).toHaveBeenCalledTimes(MODEL_FALLBACK_CHAIN.length * RETRY_DELAYS_MS.length)
  })

  it('strips markdown code fences before parsing', async () => {
    const payload = [{ q: 'Q', options: ['a', 'b', 'c', 'd'], answer: 2 }]
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => '```json\n' + JSON.stringify(payload) + '\n```' },
    })

    const result = await generateQuizQuestions({ department: 'Physics', count: 1 })

    expect(result).toEqual(payload)
  })
})
