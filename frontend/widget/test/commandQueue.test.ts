import { describe, expect, it } from 'vitest'

import {
  parseWidgetCommand,
  readQueuedCommands,
  type GroupherWidgetApi,
} from '../src/loader/commandQueue'

describe('Widget command queue', () => {
  it('parses the public v1 commands', () => {
    expect(parseWidgetCommand(['boot', { widgetKey: 'widget_public_home' }])).toEqual({
      config: { widgetKey: 'widget_public_home' },
      name: 'boot',
    })
    expect(parseWidgetCommand(['boot', { widgetKey: 'widget_public_home', mock: true }])).toEqual({
      config: { widgetKey: 'widget_public_home', mock: true },
      name: 'boot',
    })
    expect(parseWidgetCommand(['boot', { widgetKey: 'widget_public_home', mock: '1' }])).toEqual({
      config: { widgetKey: 'widget_public_home', mock: true },
      name: 'boot',
    })
    expect(parseWidgetCommand(['boot', { widgetKey: 'widget_public_home', mock: 'off' }])).toEqual({
      config: { widgetKey: 'widget_public_home', mock: false },
      name: 'boot',
    })
    expect(parseWidgetCommand(['boot', { widgetKey: 'widget_public_home', mock: 0 }])).toEqual({
      config: { widgetKey: 'widget_public_home', mock: false },
      name: 'boot',
    })
    expect(parseWidgetCommand(['open', { view: 'docs' }])).toEqual({ name: 'open', view: 'docs' })
    expect(parseWidgetCommand(['close'])).toEqual({ name: 'close' })
    expect(parseWidgetCommand(['toggle'])).toEqual({ name: 'toggle' })
    expect(parseWidgetCommand(['update', { title: 'Pricing' }])).toEqual({
      context: { title: 'Pricing' },
      name: 'update',
    })
    expect(parseWidgetCommand(['shutdown'])).toEqual({ name: 'shutdown' })
  })

  it('rejects invalid boot flags and page context values', () => {
    expect(parseWidgetCommand(['boot', { widgetKey: 'widget_public_home', mock: 2 }])).toBeNull()
    expect(
      parseWidgetCommand(['boot', { widgetKey: 'widget_public_home', mock: 'maybe' }]),
    ).toBeNull()
    expect(parseWidgetCommand(['update', { title: 42 }])).toBeNull()
    expect(parseWidgetCommand(['update', { unrelated: true }])).toBeNull()
  })

  it('drops invalid commands from a pre-loader queue', () => {
    const api = (() => undefined) as GroupherWidgetApi
    api.q = [
      ['boot', { widgetKey: 'widget_public_home' }],
      ['open', { view: 'unknown' }],
      ['remove-everything'],
    ]

    expect(readQueuedCommands(api)).toEqual([
      { config: { widgetKey: 'widget_public_home' }, name: 'boot' },
    ])
  })
})
