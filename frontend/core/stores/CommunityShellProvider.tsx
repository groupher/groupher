import type { FC, ReactNode } from 'react'

import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import { InitialNowProvider } from '~/hooks/useInitialNow'
import type { TCommunity, TLocale, TMetric, TDsb, TThemeMode, TThemeName } from '~/spec'
import AccountStoreProvider from '~/stores/account/provider'
import type { TInit as TAccountInit } from '~/stores/account/spec'
import CommunityStoreProvider from '~/stores/community/provider'
import DsbProvider from '~/stores/dsb/provider'
import LocaleStoreProvider from '~/stores/locale/provider'
import { MetricProvider } from '~/stores/metric'
import StaticWallpaperProvider from '~/stores/staticWallpaper/provider'
import ThemeStoreProvider from '~/stores/theme/provider'
import ThemePresetStoreProvider from '~/stores/ThemePreset/provider'
import type { TInit as TWallpaperInit } from '~/stores/wallpaper/spec'

type TProps = {
  children: ReactNode
  initData: {
    community: TCommunity
    dashboard: TDsb
    theme: {
      theme: TThemeName
      themeMode: TThemeMode
    }
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
  const { account, dashboard, community, theme, wallpaper } = initData

  return (
    <ThemeStoreProvider initData={theme}>
      <InitialNowProvider initialNow={initialNow}>
        <LocaleStoreProvider initData={{ locale, localeData }}>
          <MetricProvider value={metric}>
            <AccountWrapper initData={account} noAccount={noAccount}>
              <CommunityStoreProvider initData={community}>
                <DsbProvider initData={dashboard}>
                  <ThemePresetStoreProvider initData={dashboard}>
                    <StaticWallpaperProvider initData={wallpaper?.wallpaper}>
                      {children}
                    </StaticWallpaperProvider>
                  </ThemePresetStoreProvider>
                </DsbProvider>
              </CommunityStoreProvider>
            </AccountWrapper>
          </MetricProvider>
        </LocaleStoreProvider>
      </InitialNowProvider>
    </ThemeStoreProvider>
  )
}
