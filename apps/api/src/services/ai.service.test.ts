import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { generateQuizQuestions } from './ai.service'

describe('ai.service', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset()
  })

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

    const result = await generateQuizQuestions({ department: 'Math', count: 1 })

    expect(result).toEqual(payload)
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries', async () => {
    mockGenerateContent.mockRejectedValue(new Error('persistent failure'))

    await expect(generateQuizQuestions({ department: 'Math', count: 1 })).rejects.toThrow('persistent failure')
    expect(mockGenerateContent).toHaveBeenCalledTimes(3)
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
