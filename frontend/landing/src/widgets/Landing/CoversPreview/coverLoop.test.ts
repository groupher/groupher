import { describe, expect, it } from 'vitest'

import { COVER_SCENES } from '../../../const/coverScenes'
import { getCoverGeometry, getCoverSlot, SIDE_COUNT } from './coverLoop'

describe('cover loop geometry', () => {
  it('gives every scene one stable slot around each active scene', () => {
    expect(COVER_SCENES).toHaveLength(SIDE_COUNT * 2 + 1)

    for (const activeIndex of COVER_SCENES.keys()) {
      const slots = COVER_SCENES.map((_, index) => getCoverSlot(index, activeIndex))
      expect(slots.sort((left, right) => left - right)).toEqual(
        Array.from({ length: COVER_SCENES.length }, (_, index) => index - SIDE_COUNT),
      )
    }
  })

  it('wraps scenes across the edge without changing their side tile width', () => {
    const activeIndex = COVER_SCENES.findIndex((scene) => scene.id === 'feedback')
    const nextIndex = COVER_SCENES.findIndex((scene) => scene.id === 'creative')
    const shift = getCoverSlot(nextIndex, activeIndex)
    const firstSceneStart = getCoverSlot(0, activeIndex)

    expect(shift).toBe(2)
    expect(firstSceneStart - shift).toBe(-6)
    expect(getCoverSlot(0, nextIndex)).toBe(3)

    const widths = [-4, -3, -2, -1, 1, 2, 3, 4].map((slot) => getCoverGeometry(slot, 1990).width)
    expect(new Set(widths).size).toBe(1)
    expect(getCoverGeometry(0, 1990).width).toBe(940)
  })
})
