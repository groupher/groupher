import type { Metadata } from 'next'

import { GlobalProvider, GraphQLProvider } from '~/app/providers'
import { getCachedInitialNow, getCommunityInfo, getLocaleData } from '~/app/ssr'
import { LOCALE } from '~/const/i18n'
import { gqFetch } from '~/graphql/server'
import { I18N_NS } from '~/i18n/namespaces'
import { serializeCommunityThemePresetCss } from '~/lib/themePreset'
import ThirdPartyAnalyticsScripts from '~/lib/thirdPartyAnalytics/ThirdPartyAnalyticsScripts'
import MainProvider from '~/stores/provider'
import { getMetadata } from '~/utils/ssr'
import CommunityThemePresetStyle from '~/widgets/CommunityThemePresetStyle'

import Client from './Client'
import WebAnalysisScript from '../WebAnalysisScript'

const ANALYSIS_TRACKING_WEBSITE_ID_QUERY = `
  query AnalysisTrackingWebsiteId($community: String!) {
    analysisTrackingWebsiteId(community: $community)
  }
`

const getAnalysisTrackingWebsiteId = async (community: string): Promise<string | null> => {
  try {
    const response = await gqFetch(ANALYSIS_TRACKING_WEBSITE_ID_QUERY, { community })
    const payload = await response.json()

    return payload?.data?.analysisTrackingWebsiteId ?? null
  } catch (err) {
    console.error('## analysis tracking website id error: ', err)
    return null
  }
}

export async function generateMetadata({ params }): Promise<Metadata> {
  const params$ = await params
  const { dashboard } = await getCommunityInfo(params$.community)
  return getMetadata(dashboard)
}

export default async ({ children, params }) => {
  const params$ = await params
  const locale = LOCALE.EN

  const [{ community, dashboard, wallpaper }, localeData, initialNow, analysisWebsiteId] =
    await Promise.all([
      getCommunityInfo(params$.community),
      getLocaleData(locale, I18N_NS.MAIN),
      getCachedInitialNow(),
      getAnalysisTrackingWebsiteId(params$.community),
    ])
  // console.log('## localeData: ', localeData)
  // console.log('## got community$ in layout: ', community)

  return (
    <>
      <CommunityThemePresetStyle
        cssText={serializeCommunityThemePresetCss(dashboard.themeTokens)}
      />
      <ThirdPartyAnalyticsScripts configs={dashboard.enabledThirdPartyAnalytics} />
      <WebAnalysisScript websiteId={analysisWebsiteId} />

      <MainProvider
        initData={{ community, dashboard, wallpaper }}
        locale={locale}
        localeData={JSON.stringify(localeData)}
        initialNow={initialNow}
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
