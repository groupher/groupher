import { BORDER_HIGHLIGHT_MODE } from '../../constant'
import { getBorderRenderGeometry } from './helper'

const borderHighlight = {
  enabled: true,
  mode: BORDER_HIGHLIGHT_MODE.RAINBOW,
  angle: 45,
  length: 0.28,
  hue: 39,
  saturation: 77,
  lightness: 83,
  opacity: 1,
}

describe('getBorderRenderGeometry', () => {
  it('keeps image geometry when frame padding is absent', () => {
    const geometry = getBorderRenderGeometry({
      borderRadius: '20px',
      borderHighlight,
      size: 100,
    })

    expect(geometry.viewBox).toBe('0 0 177.5 100')
    expect(geometry.clipPath).toContain('A 5 5')
  })

  it('uses the outer frame geometry when frame padding is present', () => {
    const geometry = getBorderRenderGeometry({
      borderRadius: '26.5px',
      borderHighlight,
      framePadding: { x: 7.5, y: 6.5 },
      size: 100,
    })

    expect(geometry.viewBox).toBe('0 0 175.54 100')
    expect(geometry.clipPath).toContain('A 6.42 6.42')
  })
})
