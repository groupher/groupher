import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import { GlobalLayout, GraphQLProvider } from '~/providers'
import { getCommunityInfo, getLocaleData } from '~/providers/domain'
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
        <GlobalLayout>
          <Client>{children}</Client>
        </GlobalLayout>
      </GraphQLProvider>
    </MainProvider>
  )
}
