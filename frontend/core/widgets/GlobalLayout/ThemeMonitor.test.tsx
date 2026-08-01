import { act, render, waitFor } from '@testing-library/react'

import THEME, { LOCAL_THEME_KEY, THEME_FIRST_PAINT_STYLE_ID } from '~/const/theme'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'

import ThemeMonitor from './ThemeMonitor'

describe('ThemeMonitor', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame
  const originalMatchMedia = window.matchMedia

  let rafId = 0
  let rafCallbacks: FrameRequestCallback[] = []

  const flushAnimationFrame = () => {
    const callbacks = rafCallbacks
    rafCallbacks = []

    for (const callback of callbacks) {
      callback(performance.now())
    }
  }

  beforeEach(() => {
    rafId = 0
    rafCallbacks = []
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    document.getElementById(THEME_FIRST_PAINT_STYLE_ID)?.remove()

    Object.defineProperty(window, 'requestAnimationFrame', {
      writable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        rafCallbacks.push(callback)
        rafId += 1
        return rafId
      }),
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      writable: true,
      value: vi.fn(),
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({
        matches: true,
        media: '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
    window.matchMedia = originalMatchMedia
  })

  it('keeps first-paint vars until runtime dark theme has taken over', async () => {
    const style = document.createElement('style')
    style.id = THEME_FIRST_PAINT_STYLE_ID
    style.textContent = ':root { --color-title: #fff; }'
    document.head.appendChild(style)
    localStorage.setItem(LOCAL_THEME_KEY, THEME.DARK)

    const wrapper = makeStoreWrapper()
    render(<ThemeMonitor />, { wrapper })

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe(THEME.DARK)
    })

    expect(document.getElementById(THEME_FIRST_PAINT_STYLE_ID)).not.toBeNull()

    await waitFor(() => {
      expect(window.requestAnimationFrame).toHaveBeenCalled()
    })

    act(() => {
      flushAnimationFrame()
    })

    await waitFor(() => {
      expect(document.getElementById(THEME_FIRST_PAINT_STYLE_ID)).toBeNull()
    })
  })
})
