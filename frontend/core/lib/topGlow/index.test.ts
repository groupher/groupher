import THEME from '~/const/theme'
import { TOP_GLOW_LIGHT } from '~/const/top_glow'

import {
  buildTopGlowBackground,
  buildTopGlowPreviewBackground,
  resolveTopGlow,
  type TTopGlowEffect,
} from './index'

describe('top glow effects', () => {
  it('keeps existing glow keys resolvable by theme', () => {
    expect(resolveTopGlow('ORANGE_PURPLE', THEME.LIGHT)).toBe(TOP_GLOW_LIGHT.ORANGE_PURPLE)
    expect(resolveTopGlow('', THEME.LIGHT)).toBeNull()
    expect(resolveTopGlow('UNKNOWN', THEME.LIGHT)).toBeNull()
  })

  it('builds backgrounds from every radial layer instead of fixed slots', () => {
    const glow: TTopGlowEffect = {
      layers: [
        {
          type: 'radial',
          color: '#8b5cf633',
          x: '50%',
          y: '8%',
          radius: '55%',
        },
      ],
    }

    expect(buildTopGlowBackground(glow)).toBe(
      'radial-gradient(circle at 50% 8%, #8b5cf633 0, transparent 55%)',
    )
  })

  it('preserves the current effect as layered radial gradients', () => {
    const background = buildTopGlowBackground(TOP_GLOW_LIGHT.ORANGE_PURPLE)

    expect(background).toContain(
      'radial-gradient(circle at 25% -16%, #f39e8d26 0, transparent 30%)',
    )
    expect(background).toContain('radial-gradient(circle at 100% 0, #ffeba824 0, transparent 40%)')
    expect(background.match(/radial-gradient/g)).toHaveLength(4)
  })

  it('supports top-center texture presets with a single ellipse layer', () => {
    const background = buildTopGlowBackground(TOP_GLOW_LIGHT.CENTER_VIOLET)

    expect(background).toBe(
      'radial-gradient(ellipse at 50% -20%, #c4b5fd52 0, transparent 36% 24%)',
    )
  })

  it('uses preview overrides and skips non-preview layers for texture balls', () => {
    const preview = buildTopGlowPreviewBackground(TOP_GLOW_LIGHT.ORANGE_PURPLE)

    expect(preview).toContain('radial-gradient(circle at 18% 8%, #f39e8d82 0, transparent 62%)')
    expect(preview).not.toContain('#ffeba824')
    expect(preview.match(/radial-gradient/g)).toHaveLength(3)
  })
})
