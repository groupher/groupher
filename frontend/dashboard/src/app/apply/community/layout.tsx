import GlobalProvider from '~/providers/Global'
import { getCommunityInfo, getLocaleData } from '~/providers/ssr'
import MainProvider from '~/stores/provider'

export default async ({ children, params }) => {
  const params$ = await params

  const { community } = await getCommunityInfo(params$.community)
  const localeData = await getLocaleData()
  // console.log('## localeData: ', localeData)
  // console.log('## got community$ in layout: ', community)

  return (
    <MainProvider initData={community} locale='en' localeData={JSON.stringify(localeData)}>
      <GlobalProvider>{children}</GlobalProvider>
    </MainProvider>
  )
}
