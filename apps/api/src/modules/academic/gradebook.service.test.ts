import { describe, it, expect } from 'vitest'
import { calculateBestN, getLetterGrade } from './gradebook.service'

describe('calculateBestN', () => {
  it('returns null when all marks are null', () => {
    expect(calculateBestN([null, null], 1)).toBeNull()
  })

  it('returns the average of the top N when fewer entries than N', () => {
    expect(calculateBestN([10, 15], 3)).toBe(12.5)
  })

  it('returns the average of the top N ignoring nulls', () => {
    expect(calculateBestN([10, null, 20, 15, null], 2)).toBe(17.5)
  })

  it('handles all-equal marks', () => {
    expect(calculateBestN([10, 10, 10, 10], 2)).toBe(10)
  })
})

const UIU_SCALE = [
  { minPercent: 90, letter: 'A', point: 4.0 },
  { minPercent: 86, letter: 'A-', point: 3.67 },
  { minPercent: 82, letter: 'B+', point: 3.33 },
  { minPercent: 0, letter: 'F', point: 0 },
]

describe('getLetterGrade', () => {
  it('returns the correct boundary grade at exactly 90', () => {
    expect(getLetterGrade(90, UIU_SCALE)).toEqual({ letter: 'A', point: 4.0 })
  })

  it('returns the next-lower grade at 89.99', () => {
    expect(getLetterGrade(89.99, UIU_SCALE)).toEqual({ letter: 'A-', point: 3.67 })
  })

  it('returns F for very low percentages', () => {
    expect(getLetterGrade(10, UIU_SCALE)).toEqual({ letter: 'F', point: 0 })
  })
})
