import { act, renderHook, waitFor } from '@testing-library/react'

import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
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
  })
})
