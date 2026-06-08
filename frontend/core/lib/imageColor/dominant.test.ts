import { describe, expect, it } from 'vitest'

import { getDominantColorFromPixels, rgbToHex } from './dominant'

describe('dominant image color helpers', () => {
  it('returns the most frequent color bucket', () => {
    const pixels = new Uint8ClampedArray([
      210, 84, 60, 255, 212, 86, 62, 255, 214, 88, 64, 255, 30, 120, 210, 255,
    ])

    expect(getDominantColorFromPixels(pixels)?.hex).toBe('#d4563e')
  })

  it('ignores transparent and near-white background pixels', () => {
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 255, 252, 252, 252, 255, 0, 0, 0, 0, 120, 166, 96, 255,
    ])

    expect(getDominantColorFromPixels(pixels)?.css).toBe('rgb(120, 166, 96)')
  })

  it('falls back to visible pixels when every visible pixel is low signal', () => {
    const pixels = new Uint8ClampedArray([250, 250, 250, 255, 252, 252, 252, 255])

    expect(getDominantColorFromPixels(pixels)?.hex).toBe('#fbfbfb')
  })

  it('formats rgb colors as hex', () => {
    expect(rgbToHex({ r: 8, g: 32, b: 255 })).toBe('#0820ff')
  })
})
