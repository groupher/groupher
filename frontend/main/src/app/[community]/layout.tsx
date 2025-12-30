import { LOCALE } from '~/const/i18n'
import GlobalProvider from '~/providers/Global'
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
    <MainProvider initData={community} locale={LOCALE.EN} localeData={JSON.stringify(localeData)}>
      <GlobalProvider>
        <Client>{children}</Client>
      </GlobalProvider>
    </MainProvider>
  )
}
