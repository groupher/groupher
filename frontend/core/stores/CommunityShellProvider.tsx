import type { FC, ReactNode } from 'react'

import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import { InitialNowProvider } from '~/hooks/useInitialNow'
import type { TCommunity, TLocale, TMetric, TParseDashboard } from '~/spec'
import AccountStoreProvider from '~/stores/account/provider'
import type { TInit as TAccountInit } from '~/stores/account/spec'
import CommunityStoreProvider from '~/stores/community/provider'
import DashboardStoreProvider from '~/stores/dashboard/provider'
import DsbFooterLinksProvider from '~/stores/footerLinks/dsb-provider'
import LocaleStoreProvider from '~/stores/locale/provider'
import DashboardShellStyleProvider from '~/stores/shellStyle/dashboard-provider'
import ThemeStoreProvider from '~/stores/theme/provider'
import ThemePresetStoreProvider from '~/stores/ThemePreset/provider'
import WallpaperStoreProvider from '~/stores/wallpaper/provider'
import type { TInit as TWallpaperInit } from '~/stores/wallpaper/spec'

type TProps = {
  children: ReactNode
  initData: {
    community: TCommunity
    dashboard: TParseDashboard
    wallpaper?: TWallpaperInit
    account?: TAccountInit
  }
  locale?: TLocale
  localeData?: string
  initialNow?: number
  noAccount?: boolean
  metric?: TMetric
}

const AccountWrapper: FC<{
  children: ReactNode
  initData?: TAccountInit
  noAccount: boolean
}> = ({ children, initData, noAccount }) =>
  noAccount ? children : <AccountStoreProvider initData={initData}>{children}</AccountStoreProvider>

export default function CommunityShellProvider({
  children,
  initData,
  locale = LOCALE.EN,
  localeData = '{}',
  initialNow,
  noAccount = false,
  metric = METRIC.COMMUNITY,
}: TProps) {
  const { account, dashboard, community, wallpaper } = initData

  return (
    <ThemeStoreProvider>
      <InitialNowProvider initialNow={initialNow}>
        <LocaleStoreProvider initData={{ locale, localeData }}>
          <AccountWrapper initData={account} noAccount={noAccount}>
            <CommunityStoreProvider initData={community}>
              <DashboardStoreProvider initData={{ ...dashboard, metric }}>
                <DashboardShellStyleProvider>
                  <DsbFooterLinksProvider>
                    <ThemePresetStoreProvider initData={dashboard}>
                      <WallpaperStoreProvider initData={wallpaper}>
                        {children}
                      </WallpaperStoreProvider>
                    </ThemePresetStoreProvider>
                  </DsbFooterLinksProvider>
                </DashboardShellStyleProvider>
              </DashboardStoreProvider>
            </CommunityStoreProvider>
          </AccountWrapper>
        </LocaleStoreProvider>
      </InitialNowProvider>
    </ThemeStoreProvider>
  )
}
