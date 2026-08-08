import { afterEach, describe, expect, it, vi } from 'vitest'

import type { WidgetState } from '../src/app/state'
import { GROUPHER_WIDGET_TAG, GroupherWidgetElement } from '../src/element/GroupherWidget'
import { createWidgetRuntime } from '../src/main'

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

const readWidgetState = (widget: GroupherWidgetElement): WidgetState => {
  return (widget as unknown as { widgetState: WidgetState }).widgetState
}

describe('Widget runtime', () => {
  it('boots one idempotent custom element and exposes an open ShadowRoot', async () => {
    const runtime = createWidgetRuntime()

    runtime.dispatch({ config: { widgetKey: 'widget_public_home' }, name: 'boot' })
    runtime.dispatch({ config: { widgetKey: 'widget_public_home' }, name: 'boot' })

    const widgets = document.querySelectorAll<GroupherWidgetElement>(GROUPHER_WIDGET_TAG)
    expect(widgets).toHaveLength(1)
    expect(widgets[0].shadowRoot).toBeInstanceOf(ShadowRoot)

    runtime.dispatch({ name: 'open', view: 'changelog' })
    await widgets[0].updateComplete
    expect(widgets[0].dataset.open).toBe('true')
    expect(widgets[0].dataset.view).toBe('changelog')
  })

  it('shuts down and boots cleanly again', () => {
    const runtime = createWidgetRuntime()

    runtime.dispatch({ config: { widgetKey: 'widget_public_home' }, name: 'boot' })
    runtime.dispatch({ name: 'shutdown' })
    expect(document.querySelector(GROUPHER_WIDGET_TAG)).toBeNull()

    runtime.dispatch({ config: { widgetKey: 'widget_public_home' }, name: 'boot' })
    expect(document.querySelector(GROUPHER_WIDGET_TAG)).not.toBeNull()
  })

  it('resets cached data when boot switches to another widget key', async () => {
    vi.useFakeTimers()
    const runtime = createWidgetRuntime()

    runtime.dispatch({ config: { widgetKey: 'widget_public_home', mock: true }, name: 'boot' })
    runtime.dispatch({ name: 'open', view: 'posts' })

    const widget = document.querySelector<GroupherWidgetElement>(GROUPHER_WIDGET_TAG)!
    await vi.runAllTimersAsync()
    expect(readWidgetState(widget).posts.status).toBe('ready')

    runtime.dispatch({ config: { widgetKey: 'widget_public_next', mock: true }, name: 'boot' })
    expect(readWidgetState(widget).community).toBe('next')
    expect(readWidgetState(widget).posts.status).toBe('loading')

    await vi.runAllTimersAsync()
    expect(readWidgetState(widget).posts.status).toBe('ready')
  })

  it('keeps ready Home data when the panel is reopened', async () => {
    vi.useFakeTimers()
    const runtime = createWidgetRuntime()

    runtime.dispatch({ config: { widgetKey: 'widget_public_home', mock: true }, name: 'boot' })
    runtime.dispatch({ name: 'open', view: 'home' })

    const widget = document.querySelector<GroupherWidgetElement>(GROUPHER_WIDGET_TAG)!
    await vi.runAllTimersAsync()
    expect(readWidgetState(widget).home.status).toBe('ready')

    runtime.dispatch({ name: 'close' })
    runtime.dispatch({ name: 'open', view: 'home' })
    expect(readWidgetState(widget).home.status).toBe('ready')
  })
})
