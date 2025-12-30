import type { FC } from 'react'
import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import type { TCommunity, TLocale, TMetric } from '~/spec'
import AccountStoreProvider from '~/stores/account/provider'
import CommunityStoreProvider from '~/stores/community/provider'
import DashboardStoreProvider from '~/stores/dashboard/provider'
import GeneralStoreProvider from '~/stores/general/provider'
import LocaleStoreProvider from '~/stores/locale/provider'
import ThemeStoreProvider from '~/stores/theme/provider'
import WallpaperStoreProvider from '~/stores/wallpaper/provider'

type TProps = {
  children: React.ReactNode
  initData: TCommunity
  locale?: TLocale
  localeData?: string
  noAccount?: boolean
  metric?: TMetric
}

const AccountWrapper: FC<{ children: React.ReactNode; noAccount: boolean }> = ({
  children,
  noAccount,
}) => (noAccount ? children : <AccountStoreProvider>{children}</AccountStoreProvider>)

const MainProvider: FC<TProps> = ({
  children,
  initData,
  locale = LOCALE.EN,
  localeData = '{}',
  noAccount = false,
  metric = METRIC.COMMUNITY,
}) => {
  const { dashboard, ...base } = initData

  return (
    <ThemeStoreProvider>
      <LocaleStoreProvider initData={{ locale, localeData }}>
        <AccountWrapper noAccount={noAccount}>
          <CommunityStoreProvider initData={{ ...base }}>
            <DashboardStoreProvider initData={{ ...dashboard }}>
              <GeneralStoreProvider initData={{ metric }}>
                <WallpaperStoreProvider>{children}</WallpaperStoreProvider>
              </GeneralStoreProvider>
            </DashboardStoreProvider>
          </CommunityStoreProvider>
        </AccountWrapper>
      </LocaleStoreProvider>
    </ThemeStoreProvider>
  )
}

export default MainProvider
