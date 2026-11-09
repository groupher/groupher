import { describe, expect, it } from 'vitest'

import { sceneBackground } from './style'

describe('Landing Scene background serialization', () => {
  it('keeps a section transparent when it inherits the page surface', () => {
    expect(sceneBackground({ kind: 'inherit' })).toBe('transparent')
    expect(sceneBackground({ kind: 'none' })).toBe('none')
  })

  it('supports the existing page token at the end of an alpha gradient', () => {
    expect(
      sceneBackground({
        kind: 'gradient',
        angle: 180,
        stops: [
          {
            offset: 0,
            color: { kind: 'oklch', lightness: 0.94, chroma: 0.03, hue: 303, alpha: 0.3 },
          },
          { offset: 1, color: { kind: 'token', name: 'pageBg' } },
        ],
      }),
    ).toBe('linear-gradient(180deg, oklch(0.94 0.03 303 / 0.3) 0%, var(--color-pageBg) 100%)')
  })

  it('rejects CSS injection through scene assets and colors', () => {
    expect(() => sceneBackground({ kind: 'image', asset: '/landing/a.webp");color:red' })).toThrow()
    expect(() =>
      sceneBackground({ kind: 'solid', color: { kind: 'hex', value: '#fff; color:red' } }),
    ).toThrow()
  })
})
