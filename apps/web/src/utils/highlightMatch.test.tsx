import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { highlightMatch } from './highlightMatch'

function renderNode(node: React.ReactNode) {
  const { container } = render(<span>{node}</span>)
  return container
}

describe('highlightMatch', () => {
  it('returns plain string when query is too short', () => {
    const result = highlightMatch('Hello World', 'a')
    expect(result).toBe('Hello World')
  })

  it('returns plain string when query is empty', () => {
    const result = highlightMatch('Hello World', '')
    expect(result).toBe('Hello World')
  })

  it('wraps matching substring in <mark>', () => {
    const node = highlightMatch('Hello World', 'World')
    const container = renderNode(node)
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark!.textContent).toBe('World')
  })

  it('is case-insensitive', () => {
    const node = highlightMatch('Hello World', 'hello')
    const container = renderNode(node)
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark!.textContent?.toLowerCase()).toBe('hello')
  })

  it('highlights multiple occurrences', () => {
    const node = highlightMatch('ab test ab', 'ab')
    const container = renderNode(node)
    const marks = container.querySelectorAll('mark')
    expect(marks.length).toBe(2)
  })

  it('does not highlight when no match', () => {
    const node = highlightMatch('Hello World', 'xyz')
    const container = renderNode(node)
    const mark = container.querySelector('mark')
    expect(mark).toBeNull()
  })

  it('handles regex special characters in query safely', () => {
    const node = highlightMatch('price: $100', '$100')
    const container = renderNode(node)
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark!.textContent).toBe('$100')
  })
})
