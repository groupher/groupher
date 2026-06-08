import { COVER_SHADOW_COLOR_MODE, COVER_SHADOW_PRESET } from './constant'
import { getImageShadow, normalizeCoverShadow } from './helper'

describe('cover shadow helpers', () => {
  it('returns no box shadow for the none preset', () => {
    expect(
      getImageShadow({
        preset: COVER_SHADOW_PRESET.NONE,
        colorMode: COVER_SHADOW_COLOR_MODE.BLACK,
        hue: 228,
        rainbowHue: 0,
        x: 0,
        y: 10,
        blur: 24,
        spread: 0,
        opacity: 0.35,
      }),
    ).toBeUndefined()
  })

  it('uses custom offset, blur, spread, and opacity values', () => {
    expect(
      getImageShadow({
        preset: COVER_SHADOW_PRESET.CUSTOM,
        colorMode: COVER_SHADOW_COLOR_MODE.BLACK,
        hue: 228,
        rainbowHue: 0,
        x: 10,
        y: 12,
        blur: 20,
        spread: 5,
        opacity: 0.5,
      }),
    ).toContain('rgba(0, 0, 0, 0.5) 10px 12px 20px 5px')
  })

  it('builds colored layers for rainbow mode', () => {
    expect(
      getImageShadow({
        preset: COVER_SHADOW_PRESET.MEDIUM,
        colorMode: COVER_SHADOW_COLOR_MODE.RAINBOW,
        hue: 228,
        rainbowHue: 20,
        x: 0,
        y: 10,
        blur: 24,
        spread: 0,
        opacity: 0.35,
      }),
    ).toContain('hsla(20, 92%, 64%')
  })

  it('normalizes legacy numeric shadows into preset objects', () => {
    expect(normalizeCoverShadow(82).preset).toBe(COVER_SHADOW_PRESET.XLARGE)
  })
})
