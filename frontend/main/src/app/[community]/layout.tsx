import type { Metadata } from 'next'
import { GlobalProvider, GraphQLProvider } from '~/app/providers'
import { getCommunityInfo, getLocaleData } from '~/app/ssr'
import { LOCALE } from '~/const/i18n'
import { I18N_NS } from '~/i18n/namespaces'
import MainProvider from '~/stores/provider'
import { getMetadata } from '~/utils/ssr'
import Client from './Client'

export async function generateMetadata({ params }): Promise<Metadata> {
  const params$ = await params
  const { dashboard } = await getCommunityInfo(params$.community)
  return getMetadata(dashboard)
}

export default async ({ children, params }) => {
  const params$ = await params
  const locale = LOCALE.EN

  const [{ community, dashboard }, localeData] = await Promise.all([
    getCommunityInfo(params$.community),
    getLocaleData(locale, I18N_NS.MAIN),
  ])
  // console.log('## localeData: ', localeData)
  // console.log('## got community$ in layout: ', community)

  return (
    <MainProvider
      initData={{ community, dashboard }}
      locale={locale}
      localeData={JSON.stringify(localeData)}
    >
      <GraphQLProvider>
        <GlobalProvider>
          <Client>{children}</Client>
        </GlobalProvider>
      </GraphQLProvider>
    </MainProvider>
  )
}
