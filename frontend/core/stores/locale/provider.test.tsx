import { render, screen, waitFor } from '@testing-library/react'

import { LOCALE } from '~/const/i18n'
import useLocale from '~/stores/locale/hooks'

import LocaleProvider from './provider'

const LocaleValue = () => {
  const { locale, localeData, routeOverride } = useLocale()

  return (
    <output>
      {locale}|{localeData}|{String(routeOverride)}
    </output>
  )
}

describe('LocaleProvider', () => {
  it('hydrates updated locale data and route override without remounting', async () => {
    const renderProvider = (initData: {
      locale: typeof LOCALE.EN | typeof LOCALE.ZH
      localeData: string
      routeOverride?: boolean
    }) => (
      <LocaleProvider initData={initData}>
        <LocaleValue />
      </LocaleProvider>
    )
    const { rerender } = render(renderProvider({ locale: LOCALE.EN, localeData: 'english' }))

    rerender(
      renderProvider({
        locale: LOCALE.ZH,
        localeData: '中文',
        routeOverride: true,
      }),
    )

    await waitFor(() => expect(screen.getByText('zh|中文|true')).toBeInTheDocument())
  })
})
