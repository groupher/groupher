import type { FC } from 'react'
import type { TCommunity } from '~/spec'
import AccountStoreProvider from '~/stores/account.domain/provider'
import CommunityStoreProvider from '~/stores/community/provider'
import DashboardStoreProvider from '~/stores/dashboard.domain/provider'
import GeneralStoreProvider from '~/stores/general/provider'
import ThemeStoreProvider from '~/stores/theme.domain/provider'
import WallpaperStoreProvider from '~/stores/wallpaper.domain/provider'

type TCommunityInfoProvider = {
  children: React.ReactNode
  initData: TCommunity
}

export const CommunityInfoProvider: FC<TCommunityInfoProvider> = ({ children, initData }) => {
  const { dashboard, ...base } = initData

  return (
    <ThemeStoreProvider>
      <AccountStoreProvider>
        <CommunityStoreProvider initData={{ ...base }}>
          <DashboardStoreProvider initData={{ ...dashboard }}>
            <GeneralStoreProvider>
              <WallpaperStoreProvider>{children}</WallpaperStoreProvider>
            </GeneralStoreProvider>
          </DashboardStoreProvider>
        </CommunityStoreProvider>
      </AccountStoreProvider>
    </ThemeStoreProvider>
  )
}
