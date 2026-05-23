import { describe, it, expect } from 'vitest'
import { preprocessHashtags } from './preprocessHashtags'

describe('preprocessHashtags', () => {
  it('wraps a hashtag as a markdown link', () => {
    expect(preprocessHashtags('Hello #world!')).toBe('Hello [#world](/explore/tag/world)!')
  })

  it('lowercases the tag name in the URL while preserving display casing', () => {
    expect(preprocessHashtags('#CSEFest')).toBe('[#CSEFest](/explore/tag/csefest)')
  })

  it('handles multiple hashtags in one string', () => {
    expect(preprocessHashtags('#a and #b')).toBe('[#a](/explore/tag/a) and [#b](/explore/tag/b)')
  })

  it('does not double-wrap an already-linked hashtag', () => {
    const input = '[#world](/explore/tag/world)'
    expect(preprocessHashtags(input)).toBe(input)
  })

  it('returns empty string unchanged', () => {
    expect(preprocessHashtags('')).toBe('')
  })

  it('does not touch a bare # with no word chars', () => {
    expect(preprocessHashtags('price is # 100')).toBe('price is # 100')
  })

  it('handles hashtag at start of string', () => {
    expect(preprocessHashtags('#uiu rocks')).toBe('[#uiu](/explore/tag/uiu) rocks')
  })
})
