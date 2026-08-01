import { act, renderHook, waitFor } from '@testing-library/react'

import THEME, { LOCAL_THEME_KEY, THEME_FIRST_PAINT_STYLE_ID, THEME_MODE } from '~/const/theme'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useTheme from '~/hooks/useTheme'

let mockMatchMediaDark = false

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => {
    return {
      media: query,
      matches: mockMatchMediaDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }
  },
})

describe('useTheme', () => {
  beforeEach(() => {
    mockMatchMediaDark = false
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    document.getElementById(THEME_FIRST_PAINT_STYLE_ID)?.remove()
  })

  it('toggles theme and writes to DOM + localStorage', async () => {
    const wrapper = makeStoreWrapper()
    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe(THEME.LIGHT)
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()

    act(() => result.current.toggle())

    await waitFor(() => {
      expect(result.current.theme).toBe(THEME.DARK)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe(THEME.DARK)

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    act(() => result.current.changeMode(THEME_MODE.LIGHT))

    await waitFor(() => {
      expect(result.current.themeMode).toBe(THEME_MODE.LIGHT)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe(THEME.LIGHT)
    expect(document.documentElement.style.colorScheme).toBe(THEME.LIGHT)
    expect(setItemSpy).toHaveBeenCalledWith(LOCAL_THEME_KEY, THEME_MODE.LIGHT)
  })

  it('resolves SYSTEM mode via matchMedia', async () => {
    mockMatchMediaDark = true
    const wrapper = makeStoreWrapper()
    const { result } = renderHook(() => useTheme(), { wrapper })

    await act(async () => {
      result.current.changeMode(THEME_MODE.SYSTEM)
    })

    await waitFor(() => {
      expect(result.current.themeMode).toBe(THEME_MODE.SYSTEM)
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe(THEME.DARK)
    expect(document.documentElement.style.colorScheme).toBe(THEME.DARK)
  })

  it('keeps initial store state independent from the DOM theme attribute', () => {
    document.documentElement.setAttribute('data-theme', THEME.DARK)

    const wrapper = makeStoreWrapper()
    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.themeMode).toBe(THEME_MODE.SYSTEM)
    expect(result.current.theme).toBe(THEME.LIGHT)
    expect(result.current.isLightTheme).toBe(true)
  })

  it('previews theme without changing persisted mode', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const wrapper = makeStoreWrapper()
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => result.current.preview(THEME.DARK))

    await waitFor(() => {
      expect(result.current.theme).toBe(THEME.DARK)
    })

    expect(result.current.themeMode).toBe(THEME_MODE.SYSTEM)
    expect(document.documentElement.getAttribute('data-theme')).toBe(THEME.DARK)
    expect(document.documentElement.style.colorScheme).toBe(THEME.DARK)
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('removes first-paint vars when runtime theme takes over', async () => {
    const style = document.createElement('style')
    style.id = THEME_FIRST_PAINT_STYLE_ID
    style.textContent = ':root { --color-title: #fff; }'
    document.head.appendChild(style)

    const wrapper = makeStoreWrapper()
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => result.current.changeMode(THEME_MODE.DARK))

    await waitFor(() => {
      expect(result.current.theme).toBe(THEME.DARK)
    })

    expect(document.getElementById(THEME_FIRST_PAINT_STYLE_ID)).toBeNull()
  })

  it('can preserve first-paint vars while ThemeMonitor hands off to runtime theme', async () => {
    const style = document.createElement('style')
    style.id = THEME_FIRST_PAINT_STYLE_ID
    style.textContent = ':root { --color-title: #fff; }'
    document.head.appendChild(style)

    const wrapper = makeStoreWrapper()
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => result.current.changeMode(THEME_MODE.DARK, { keepFirstPaintVars: true }))

    await waitFor(() => {
      expect(result.current.theme).toBe(THEME.DARK)
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe(THEME.DARK)
    expect(document.getElementById(THEME_FIRST_PAINT_STYLE_ID)).not.toBeNull()
  })
})
