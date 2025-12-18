import { GlobalLayout } from '~/providers'
import { getCommunityInfo, getLocaleData } from '~/providers/domain'
import MainProvider from '~/stores/provider'

export default async ({ children, params }) => {
  const params$ = await params

  const { community } = await getCommunityInfo(params$.community)
  const localeData = await getLocaleData()
  // console.log('## localeData: ', localeData)
  // console.log('## got community$ in layout: ', community)

  return (
    <MainProvider initData={community} locale='en' localeData={JSON.stringify(localeData)}>
      <GlobalLayout>{children}</GlobalLayout>
    </MainProvider>
  )
}
