import type { Metadata } from 'next'

import { GlobalProvider, GraphQLProvider } from '~/app/providers'
import { getCommunityInfo, getLocaleData } from '~/app/ssr'
import { LOCALE } from '~/const/i18n'
import { I18N_NS } from '~/i18n/namespaces'
import { serializeCommunityThemePresetCss } from '~/lib/themePreset'
import ThirdPartyAnalyticsScripts from '~/lib/thirdPartyAnalytics/ThirdPartyAnalyticsScripts'
import MainProvider from '~/stores/provider'
import { getMetadata } from '~/utils/ssr'
import CommunityThemePresetStyle from '~/widgets/CommunityThemePresetStyle'

import WebAnalysisScript from '../WebAnalysisScript'
import Client from './Client'

export async function generateMetadata({ params }): Promise<Metadata> {
  const params$ = await params
  const { dashboard } = await getCommunityInfo(params$.community)
  return getMetadata(dashboard)
}

export default async ({ children, params }) => {
  const params$ = await params
  const locale = LOCALE.EN

  const [{ community, dashboard, wallpaper }, localeData] = await Promise.all([
    getCommunityInfo(params$.community),
    getLocaleData(locale, I18N_NS.MAIN),
  ])
  // console.log('## localeData: ', localeData)
  // console.log('## got community$ in layout: ', community)

  return (
    <>
      <CommunityThemePresetStyle
        cssText={serializeCommunityThemePresetCss(dashboard.themeTokens)}
      />
      <ThirdPartyAnalyticsScripts configs={dashboard.enabledThirdPartyAnalytics} />
      <WebAnalysisScript websiteId={dashboard.umamiWebsiteId} />

      <MainProvider
        initData={{ community, dashboard, wallpaper }}
        locale={locale}
        localeData={JSON.stringify(localeData)}
      >
        <GraphQLProvider>
          <GlobalProvider>
            <Client>{children}</Client>
          </GlobalProvider>
        </GraphQLProvider>
      </MainProvider>
    </>
  )
}
