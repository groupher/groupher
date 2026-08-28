import type { ReactNode } from 'react'

import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import { InitialNowProvider } from '~/hooks/useInitialNow'
import type { TCommunity, TFooterLinks, TLocale } from '~/spec'
import CommunityStoreProvider from '~/stores/community/provider'
import DsbStoreProvider from '~/stores/dsb/provider'
import LocaleStoreProvider from '~/stores/locale/provider'
import ThemeStoreProvider from '~/stores/theme/provider'
import WallpaperStoreProvider from '~/stores/wallpaper/provider'
import type { TInit as TWallpaperInit } from '~/stores/wallpaper/spec'

type TProps = {
  children: ReactNode
  community: TCommunity
  footerLinks: TFooterLinks
  wallpaper?: TWallpaperInit
  locale?: TLocale
  localeData?: string
  initialNow?: number
}

export default function StaticShellProvider({
  children,
  community,
  footerLinks,
  wallpaper,
  locale = LOCALE.EN,
  localeData = '{}',
  initialNow,
}: TProps) {
  return (
    <ThemeStoreProvider>
      <InitialNowProvider initialNow={initialNow}>
        <LocaleStoreProvider initData={{ locale, localeData }}>
          <CommunityStoreProvider initData={community}>
            <DsbStoreProvider
              initData={{
                metric: METRIC.LANDING,
                footerLayout: footerLinks.layout,
                footerLinks: footerLinks.links,
                footerOnelineLinks: footerLinks.onelineLinks,
              }}
            >
              <WallpaperStoreProvider initData={wallpaper}>{children}</WallpaperStoreProvider>
            </DsbStoreProvider>
          </CommunityStoreProvider>
        </LocaleStoreProvider>
      </InitialNowProvider>
    </ThemeStoreProvider>
  )
}
