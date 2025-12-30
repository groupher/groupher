import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import GlobalProvider from '~/providers/Global'
import GraphQLProvider from '~/providers/GraphQL'
import { getCommunityInfo, getLocaleData } from '~/providers/ssr'
import MainProvider from '~/stores/provider'
import Client from './Client'

export default async ({ children, params }) => {
  const params$ = await params

  const { community } = await getCommunityInfo(params$.community)
  const localeData = await getLocaleData()
  // console.log('## localeData: ', localeData)
  // console.log('## got community$ in layout: ', community)

  return (
    <MainProvider
      initData={community}
      locale={LOCALE.EN}
      metric={METRIC.DASHBOARD}
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
