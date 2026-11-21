import { act, renderHook } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

import usePagiConfig from './usePagiConfig'

const preference = { pagiMode: 'PAGE', pagiMobileMode: 'INFINITE_SCROLL', pagiRevision: 3 } as const
const width = (value: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, value })
const originalWidth = window.innerWidth

afterEach(() => width(originalWidth))

it.each([390, 768, 1024, 1279])('selects mobile cursor defaults at %ipx', (value) => {
  width(value)
  const { result } = renderHook(() => usePagiConfig(preference, 'xx/post'))
  expect(result.current).toMatchObject({
    ready: true,
    config: { api: 'cursor', mode: 'INFINITE_SCROLL', revision: 3 },
  })
})

it('selects desktop at the xl boundary, preserves it on resize and reselects for a new collection', () => {
  width(1280)
  const { result, rerender } = renderHook(({ scope }) => usePagiConfig(preference, scope), {
    initialProps: { scope: 'xx/post' },
  })
  expect(result.current.config.mode).toBe('PAGE')
  width(768)
  act(() => window.dispatchEvent(new Event('resize')))
  rerender({ scope: 'xx/post' })
  expect(result.current.config.mode).toBe('PAGE')
  rerender({ scope: 'xx/changelog' })
  expect(result.current.config.mode).toBe('INFINITE_SCROLL')
})

it('honors independent mobile overrides', () => {
  width(768)
  const { result } = renderHook(() =>
    usePagiConfig({ ...preference, pagiMobileMode: 'LOAD_MORE' }, 'xx'),
  )
  expect(result.current.config).toMatchObject({ api: 'cursor', mode: 'LOAD_MORE' })
})

it('keeps the SSR snapshot unresolved even when rendering in a browser-like environment', () => {
  width(768)
  let ready: boolean | undefined
  function Probe() {
    ready = usePagiConfig(preference, 'xx').ready
    return null
  }
  renderToString(<Probe />)
  expect(ready).toBe(false)
})

it('hydrates a mobile list without a desktop render or hydration mismatch', async () => {
  width(768)
  const error = vi.fn()
  function Probe() {
    const { config, ready } = usePagiConfig(preference, 'xx')
    return <span>{ready ? config.mode : 'pending'}</span>
  }
  const container = document.createElement('div')
  container.innerHTML = renderToString(<Probe />)
  expect(container.textContent).toBe('pending')
  let root: ReturnType<typeof hydrateRoot>
  await act(async () => {
    root = hydrateRoot(container, <Probe />, { onRecoverableError: error })
  })
  expect(container.textContent).toBe('INFINITE_SCROLL')
  expect(error).not.toHaveBeenCalled()
  await act(async () => root.unmount())
})
