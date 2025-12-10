import type { FC } from 'react'
import type { TCommunity } from '~/spec'
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
      <GeneralStoreProvider>
        <WallpaperStoreProvider>
          <CommunityStoreProvider initData={{ ...base }}>
            <DashboardStoreProvider initData={{ ...dashboard }}>{children}</DashboardStoreProvider>
          </CommunityStoreProvider>
        </WallpaperStoreProvider>
      </GeneralStoreProvider>
    </ThemeStoreProvider>
  )
}
