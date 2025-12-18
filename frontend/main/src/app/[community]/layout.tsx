import { GlobalLayout } from '~/providers'
import { getCommunityInfo, getLocaleData } from '~/providers/domain'
import LocaleStoreProvider from '~/stores/locale/provider'
import CommunityInfoProvider from '~/stores/provider'
import Client from './Client'

export default async ({ children, params }) => {
  const params$ = await params

  const { community } = await getCommunityInfo(params$.community)
  const localeData = await getLocaleData()
  // console.log('## localeData: ', localeData)
  // console.log('## got community$ in layout: ', community)

  return (
    <LocaleStoreProvider initData={{ locale: 'en', localeData: JSON.stringify(localeData) }}>
      <CommunityInfoProvider initData={community}>
        <GlobalLayout>
          <Client>{children}</Client>
        </GlobalLayout>
      </CommunityInfoProvider>
    </LocaleStoreProvider>
  )
}
