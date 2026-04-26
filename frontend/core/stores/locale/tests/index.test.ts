import { LOCALE } from '~/const/i18n'
import type { TInit } from '~/stores/locale/spec'

import setupStore from '..'

describe('stores/locale', () => {
  it('updates locale and localeData', () => {
    const init: TInit = {
      locale: LOCALE.EN,
      localeData: JSON.stringify({ hello: 'Hello' }),
    }

    const store = setupStore(init)

    expect(store.locale).toBe(LOCALE.EN)
    expect(JSON.parse(store.localeData).hello).toBe('Hello')

    store.setLocale(LOCALE.ZH)
    store.setLocaleData(JSON.stringify({ hello: '你好', empty: '' }))

    expect(store.locale).toBe(LOCALE.ZH)
    expect(JSON.parse(store.localeData).hello).toBe('你好')
  })
})
