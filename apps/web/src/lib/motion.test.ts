import { describe, expect, it } from 'vitest'
import { DUR, EASE_OUT_EXPO, popoverIn, modalIn, drawerIn, listStagger, listItem } from './motion'

describe('motion presets', () => {
  it('exposes duration constants in seconds', () => {
    expect(DUR).toEqual({ fast: 0.15, med: 0.2, slow: 0.3 })
  })

  it('popoverIn scales from 0.96 and exits faster than it enters', () => {
    expect(popoverIn.initial).toMatchObject({ opacity: 0, scale: 0.96 })
    expect(popoverIn.animate).toMatchObject({ opacity: 1, scale: 1 })
    expect(popoverIn.exit).toMatchObject({ opacity: 0, scale: 0.96 })
    expect(popoverIn.transition.duration).toBe(DUR.med)
    expect(popoverIn.exitTransition.duration).toBeLessThan(popoverIn.transition.duration)
  })

  it('modalIn and drawerIn are complete variant sets', () => {
    for (const v of [modalIn, drawerIn]) {
      expect(v.initial).toBeDefined()
      expect(v.animate).toBeDefined()
      expect(v.exit).toBeDefined()
    }
    expect(drawerIn.initial).toMatchObject({ y: '100%' })
    expect(drawerIn.transition.ease).toEqual([0.32, 0.72, 0, 1])
  })

  it('listStagger produces container variants with per-child delay', () => {
    const c = listStagger(40)
    expect(c.animate.transition.staggerChildren).toBe(0.04)
    expect(listItem.initial).toMatchObject({ opacity: 0, y: 8 })
  })

  it('easings are cubic-bezier tuples', () => {
    expect(EASE_OUT_EXPO).toEqual([0.16, 1, 0.3, 1])
  })
})
