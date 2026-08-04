import { LOCAL_THEME_KEY, THEME_FIRST_PAINT_STYLE_ID, THEME_MODE } from '~/const/theme'
import { THEME_FIRST_PAINT_VAR_NAMES } from '~/const/theme-first-paint.generated'

import {
  injectThemeFirstPaintVars,
  prePaintRuntimeSeedScript,
  prePaintThemeDetectScript,
  THEME_FIRST_PAINT_VARS_SCRIPT,
} from './script'

const runInlineScript = (script: string) => {
  Function(script)()
}

describe('prePaintThemeDetectScript', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
      })),
    })
  })

  it('applies persisted theme before paint', () => {
    localStorage.setItem(LOCAL_THEME_KEY, THEME_MODE.DARK)

    runInlineScript(prePaintThemeDetectScript())

    expect(document.documentElement.getAttribute('data-theme')).toBe(THEME_MODE.DARK)
    expect(document.documentElement.style.colorScheme).toBe(THEME_MODE.DARK)
  })

  it('falls back to system preference when persisted mode is not concrete', () => {
    localStorage.setItem(LOCAL_THEME_KEY, THEME_MODE.SYSTEM)
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      media: '(prefers-color-scheme: dark)',
    } as MediaQueryList)

    runInlineScript(prePaintThemeDetectScript())

    expect(document.documentElement.getAttribute('data-theme')).toBe(THEME_MODE.DARK)
    expect(document.documentElement.style.colorScheme).toBe(THEME_MODE.DARK)
  })
})

describe('prePaintRuntimeSeedScript', () => {
  it('captures a browser-side initial timestamp before hydration', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456)

    runInlineScript(prePaintRuntimeSeedScript())

    expect(
      (window as Window & { __GROUPHER_INITIAL_NOW__?: number }).__GROUPHER_INITIAL_NOW__,
    ).toBe(123456)
  })
})

describe('injectThemeFirstPaintVars', () => {
  beforeEach(() => {
    document.getElementById(THEME_FIRST_PAINT_STYLE_ID)?.remove()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('style')
  })

  it('serializes generated CSS var names into the inline script', () => {
    const script = THEME_FIRST_PAINT_VARS_SCRIPT

    expect(script).toContain(THEME_FIRST_PAINT_STYLE_ID)
    expect(script).toContain(THEME_FIRST_PAINT_VAR_NAMES[0])
    expect(script).toContain('--shadow-card')
    expect(script).toContain('!important')
    expect(script).not.toContain('MutationObserver')
    expect(script).not.toContain('setTimeout')
    expect(script).not.toContain('requestAnimationFrame')
    expect(script).not.toContain('DOMContentLoaded')
    expect(script).not.toContain('__groupherThemeFirstPaintDone')
    expect(script).toContain('style.disabled = true')
    expect(script).toBe(injectThemeFirstPaintVars())
  })

  it('snapshots computed CSS vars into a temporary style tag', () => {
    vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) =>
        ({
          '--color-title': '#f5f5f5',
          '--color-card': 'rgb(37, 37, 37)',
        })[name] || '',
    } as CSSStyleDeclaration)

    runInlineScript(injectThemeFirstPaintVars())

    const style = document.getElementById(THEME_FIRST_PAINT_STYLE_ID)

    expect(style).not.toBeNull()
    expect(style?.textContent).toContain('--color-title:#f5f5f5 !important;')
    expect(style?.textContent).toContain('--color-card:rgb(37, 37, 37) !important;')
  })

  it('snapshots values returned by computed style for the active theme', () => {
    vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) =>
        ({
          '--color-title': '#eeeeee',
          '--color-card': '#222222',
          '--shadow-card': '0 8px 24px rgb(0 0 0 / 20%)',
        })[name] || '',
    } as CSSStyleDeclaration)

    runInlineScript(injectThemeFirstPaintVars())

    const style = document.getElementById(THEME_FIRST_PAINT_STYLE_ID)

    expect(style?.textContent).toContain('--color-title:#eeeeee !important;')
    expect(style?.textContent).toContain('--color-card:#222222 !important;')
    expect(style?.textContent).toContain('--shadow-card:0 8px 24px rgb(0 0 0 / 20%) !important;')
  })

  it('overwrites an existing fallback snapshot with later route vars', () => {
    document.documentElement.setAttribute('data-theme', THEME_MODE.DARK)
    const fallbackStyle = document.createElement('style')
    fallbackStyle.id = THEME_FIRST_PAINT_STYLE_ID
    fallbackStyle.textContent = ':root{--color-title:#aaaaaa !important;}'
    document.head.appendChild(fallbackStyle)

    const routeStyle = document.createElement('style')
    routeStyle.textContent = `
      :root { --color-title: #111111; }
      [data-theme='dark'] {
        --color-title: #eeeeee;
        --color-page-custom-bg: #333333;
      }
    `
    document.head.appendChild(routeStyle)

    runInlineScript(injectThemeFirstPaintVars())

    const style = document.getElementById(THEME_FIRST_PAINT_STYLE_ID)

    expect(style).toBe(fallbackStyle)
    expect(style?.textContent).toContain('--color-page-custom-bg:#333333 !important;')

    routeStyle.remove()
  })

  it('removes a stale snapshot when no computed vars are available', () => {
    const fallbackStyle = document.createElement('style')
    fallbackStyle.id = THEME_FIRST_PAINT_STYLE_ID
    fallbackStyle.textContent = ':root{--color-title:#aaaaaa !important;}'
    document.head.appendChild(fallbackStyle)
    vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration)

    runInlineScript(injectThemeFirstPaintVars())

    expect(document.getElementById(THEME_FIRST_PAINT_STYLE_ID)).toBeNull()
  })
})
