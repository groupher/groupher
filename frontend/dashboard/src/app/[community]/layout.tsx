import type { Metadata } from 'next'

import { GlobalProvider, GraphQLProvider } from '~/app/providers'
import { getCommunityInfo, getLocaleData } from '~/app/ssr'
import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import { I18N_NS } from '~/i18n/namespaces'
import { serializeCommunityThemePresetCss } from '~/lib/themePreset'
import CommunityThemePresetStyle from '~/shell/CommunityThemePresetStyle'
import MainProvider from '~/stores/provider'
import { isDsbDemoMode } from '~/utils/dsb-demo'
import { getMetadata } from '~/utils/ssr'

import Client from './Client'

const parseLocale = (lang?: string | string[]) => {
  const langValue = Array.isArray(lang) ? lang[0] : lang

  return langValue === LOCALE.ZH ? LOCALE.ZH : LOCALE.EN
}

/** Runs the generate metadata operation at the frontend shared boundary. */
export async function generateMetadata({ params }): Promise<Metadata> {
  const params$ = await params
  const { dashboard } = await getCommunityInfo(params$.community)
  return getMetadata(dashboard)
}

export default async ({ children, params, searchParams }) => {
  const params$ = await params
  const searchParams$ = await searchParams
  const locale = parseLocale(searchParams$?.lang)
  const isDemoMode = isDsbDemoMode(params$.community, searchParams$?.mode)

  const [{ community, dashboard, wallpaper }, localeData] = await Promise.all([
    getCommunityInfo(params$.community),
    getLocaleData(locale, [...I18N_NS.DASHBOARD, ...I18N_NS.PASSPORT]),
  ])

  return (
    <>
      <CommunityThemePresetStyle
        cssText={serializeCommunityThemePresetCss(dashboard.themeTokens)}
      />

      <MainProvider
        initData={{ community, dashboard, wallpaper }}
        locale={locale}
        metric={METRIC.DASHBOARD}
        localeData={JSON.stringify(localeData)}
      >
        <GraphQLProvider>
          <GlobalProvider>
            <Client demoMode={isDemoMode}>{children}</Client>
          </GlobalProvider>
        </GraphQLProvider>
      </MainProvider>
    </>
  )
}
