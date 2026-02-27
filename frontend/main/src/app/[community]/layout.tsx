import type { Metadata } from 'next'
import { LOCALE } from '~/const/i18n'
import GlobalProvider from '~/providers/Global'
import GraphQLProvider from '~/providers/GraphQL'
import { getCommunityInfo, getLocaleData } from '~/providers/ssr'
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
    getLocaleData(),
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
