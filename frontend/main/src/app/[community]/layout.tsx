import { LOCALE } from '~/const/i18n'
import { GlobalLayout } from '~/providers'
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
    <MainProvider initData={community} locale={LOCALE.EN} localeData={JSON.stringify(localeData)}>
      <GlobalLayout>
        <Client>{children}</Client>
      </GlobalLayout>
    </MainProvider>
  )
}
