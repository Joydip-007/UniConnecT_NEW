import { describe, expect, it } from 'vitest'
import { scoreQuiz, selectDailyQuestions } from './quizEngine'

const QUESTIONS = [
  { q: 'What is 2+2?', options: ['3', '4', '5', '6'], answer: 1 },
  { q: 'Capital of France?', options: ['Berlin', 'Madrid', 'Paris', 'Rome'], answer: 2 },
  { q: 'HTTP status for OK?', options: ['200', '201', '404', '500'], answer: 0 },
]

describe('scoreQuiz', () => {
  it('returns 100 for all correct', () => {
    const result = scoreQuiz(QUESTIONS, [1, 2, 0])
    expect(result.score).toBe(100)
    expect(result.correctCount).toBe(3)
    expect(result.totalQuestions).toBe(3)
  })

  it('returns 0 for all wrong', () => {
    const result = scoreQuiz(QUESTIONS, [0, 0, 1])
    expect(result.score).toBe(0)
    expect(result.correctCount).toBe(0)
  })

  it('scores partial correctly (1 of 3 = floor 33)', () => {
    const result = scoreQuiz(QUESTIONS, [1, 0, 1])
    expect(result.score).toBe(33)
    expect(result.correctCount).toBe(1)
  })

  it('treats missing answers as wrong', () => {
    const result = scoreQuiz(QUESTIONS, [1, 2])
    expect(result.totalQuestions).toBe(3)
    expect(result.correctCount).toBe(2)
  })
})

describe('selectDailyQuestions', () => {
  it('returns exactly count questions', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ({ q: `Q${i}`, options: ['A', 'B'], answer: 0 }))
    expect(selectDailyQuestions(pool, 5, '2026-07-06-cs')).toHaveLength(5)
  })

  it('returns same selection for same seed', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ({ q: `Q${i}`, options: ['A', 'B'], answer: 0 }))
    expect(selectDailyQuestions(pool, 5, 'seed-a')).toEqual(selectDailyQuestions(pool, 5, 'seed-a'))
  })

  it('returns different selection for different seed', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ({ q: `Q${i}`, options: ['A', 'B'], answer: 0 }))
    expect(selectDailyQuestions(pool, 5, 'seed-a')).not.toEqual(selectDailyQuestions(pool, 5, 'seed-b'))
  })

  it('returns all items if pool smaller than count', () => {
    const pool = [{ q: 'Q0', options: ['A', 'B'], answer: 0 }]
    expect(selectDailyQuestions(pool, 5, 'x')).toHaveLength(1)
  })
})
