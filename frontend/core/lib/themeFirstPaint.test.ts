import { THEME_FIRST_PAINT_STYLE_ID } from '~/const/theme'

import { removeThemeFirstPaintVars, scheduleRemoveThemeFirstPaintVars } from './themeFirstPaint'

describe('themeFirstPaint', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame

  beforeEach(() => {
    document.getElementById(THEME_FIRST_PAINT_STYLE_ID)?.remove()
  })

  afterEach(() => {
    vi.useRealTimers()
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
  })

  const appendFirstPaintStyle = () => {
    const style = document.createElement('style')
    style.id = THEME_FIRST_PAINT_STYLE_ID
    style.textContent = ':root { --color-title: #fff; }'
    document.head.appendChild(style)
  }

  it('removes first-paint vars', () => {
    appendFirstPaintStyle()

    removeThemeFirstPaintVars()

    expect(document.getElementById(THEME_FIRST_PAINT_STYLE_ID)).toBeNull()
  })

  it('delays cleanup until the next paint handoff', () => {
    appendFirstPaintStyle()

    let callback: FrameRequestCallback | null = null
    window.requestAnimationFrame = vi.fn((nextCallback: FrameRequestCallback) => {
      callback = nextCallback
      return 1
    })
    window.cancelAnimationFrame = vi.fn()

    scheduleRemoveThemeFirstPaintVars()

    expect(document.getElementById(THEME_FIRST_PAINT_STYLE_ID)).not.toBeNull()

    callback?.(0)

    expect(document.getElementById(THEME_FIRST_PAINT_STYLE_ID)).toBeNull()
  })

  it('uses a timer fallback when requestAnimationFrame is unavailable', () => {
    vi.useFakeTimers()
    appendFirstPaintStyle()

    window.requestAnimationFrame = undefined as unknown as typeof window.requestAnimationFrame
    window.cancelAnimationFrame = vi.fn()

    scheduleRemoveThemeFirstPaintVars()

    expect(document.getElementById(THEME_FIRST_PAINT_STYLE_ID)).not.toBeNull()

    vi.runOnlyPendingTimers()

    expect(document.getElementById(THEME_FIRST_PAINT_STYLE_ID)).toBeNull()
  })
})
