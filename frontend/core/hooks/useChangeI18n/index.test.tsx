import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import useLocale from '~/stores/locale/hooks'
import LocaleProvider from '~/stores/locale/provider'
import { MetricProvider } from '~/stores/metric'

import useChangeI18n from './index'

const mocks = vi.hoisted(() => ({ loadLocaleFile: vi.fn() }))

vi.mock('~/i18n', () => ({
  getI18nNamespacesByMetric: () => [],
  loadLocaleFile: mocks.loadLocaleFile,
}))

describe('useChangeI18n', () => {
  it('ignores an older locale load after a newer locale request', async () => {
    const pending = new Map<string, (value: Record<string, string>) => void>()
    mocks.loadLocaleFile.mockImplementation(
      (locale: string) =>
        new Promise((resolve) => {
          pending.set(locale, resolve)
        }),
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MetricProvider value={METRIC.DASHBOARD}>
        <LocaleProvider initData={{ locale: LOCALE.EN, localeData: 'initial' }}>
          {children}
        </LocaleProvider>
      </MetricProvider>
    )
    const { result } = renderHook(() => ({ locale: useLocale(), changeI18n: useChangeI18n() }), {
      wrapper,
    })

    act(() => {
      result.current.changeI18n.changeLocale(LOCALE.ZH)
      result.current.changeI18n.changeLocale(LOCALE.EN)
    })
    await waitFor(() => expect(pending.size).toBe(2))

    await act(async () => pending.get(LOCALE.EN)?.({ message: 'English' }))
    await waitFor(() => expect(result.current.locale.localeData).toBe('{"message":"English"}'))
    await act(async () => pending.get(LOCALE.ZH)?.({ message: '中文' }))

    expect(result.current.locale.locale).toBe(LOCALE.EN)
    expect(result.current.locale.localeData).toBe('{"message":"English"}')
  })
})
