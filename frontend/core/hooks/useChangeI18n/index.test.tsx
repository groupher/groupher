import { act, renderHook, waitFor } from '@testing-library/react'
import METRIC from '~/const/metric'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useChangeI18n from '~/hooks/useChangeI18n'
import useTrans from '~/hooks/useTrans'
import type { TLocale } from '~/spec'

const { loadLocaleFile } = vi.hoisted(() => ({
  loadLocaleFile: vi.fn(async () => ({ post: 'Hi' })),
}))

vi.mock('~/i18n', () => {
  return {
    getI18nNamespacesByMetric: vi.fn((metric) =>
      metric === METRIC.DASHBOARD ? ['base', 'dashboard'] : ['base', 'main'],
    ),
    loadLocaleFile,
  }
})

describe('useChangeI18n', () => {
  it('loads locale file and commits to locale store', async () => {
    const wrapper = makeStoreWrapper({ localeData: '{}', metric: METRIC.COMMUNITY })
    const { result } = renderHook(() => ({ i18n: useChangeI18n(), trans: useTrans() }), { wrapper })

    const zh: TLocale = 'zh'
    act(() => result.current.i18n.changeLocale(zh))

    await waitFor(() => {
      expect(result.current.i18n.locale).toBe(zh)
    })
    await waitFor(() => {
      expect(result.current.trans.t('post')).toBe('Hi')
    })
    expect(loadLocaleFile).toHaveBeenCalledWith(zh, ['base', 'main'])
  })
})
