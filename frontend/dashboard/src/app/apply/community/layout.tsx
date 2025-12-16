import { GlobalLayout } from '~/providers'
import { getCommunityInfo, getLocaleData } from '~/providers/domain'
import LocaleStoreProvider from '~/stores/locale.domain/provider'
import { CommunityInfoProvider } from '~/stores/provider'

export default async ({ children, params }) => {
  const params$ = await params

  const { community } = await getCommunityInfo(params$.community)
  const localeData = await getLocaleData()
  // console.log('## localeData: ', localeData)
  // console.log('## got community$ in layout: ', community)

  return (
    <LocaleStoreProvider initData={{ locale: 'en', localeData: JSON.stringify(localeData) }}>
      <CommunityInfoProvider initData={community}>
        <GlobalLayout>{children}</GlobalLayout>
      </CommunityInfoProvider>
    </LocaleStoreProvider>
  )
}
