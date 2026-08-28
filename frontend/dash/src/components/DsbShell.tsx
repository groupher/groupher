import type { TCommunityShell } from '@dash/server/community'
import { type ReactNode, useEffect } from 'react'

import { GlobalProvider } from '~/app/providers'
import METRIC from '~/const/metric'
import DsbStoreProvider from '~/stores/dsb/provider'
import ThemePresetStoreProvider from '~/stores/ThemePreset/provider'
import WallpaperStoreProvider from '~/stores/wallpaper/provider'
import CommunityDigest from '~/unit/CommunityDigest/DsbLayout'
import { SideMenu } from '~/unit/DsbThread'

import { clearAuthRouteRecoveryAttempt } from '../utils/auth-route-recovery'

type TProps = {
  children: ReactNode
  shell: TCommunityShell
}

export default function DsbShell({ children, shell }: TProps) {
  useEffect(() => {
    clearAuthRouteRecoveryAttempt(window.location.href)
  }, [])

  return (
    <DsbStoreProvider initData={{ ...shell.dashboard, metric: METRIC.DASHBOARD }}>
      <ThemePresetStoreProvider initData={shell.dashboard}>
        <WallpaperStoreProvider initData={shell.wallpaper}>
          <GlobalProvider authLoginModal={false}>
            <div
              className='column-center min-h-full w-full justify-start'
              data-demo-mode={shell.demoMode}
            >
              <div className='container-dashboard relative w-full transition-all duration-150 ease-out'>
                <CommunityDigest />

                <div className='row mt-7 min-h-screen w-full'>
                  <div className='shrink-0 self-stretch overflow-visible transition-all duration-150 ease-out'>
                    <SideMenu />
                  </div>
                  <div className='column min-w-0 grow items-center bg-transparent'>{children}</div>
                </div>
              </div>
            </div>
          </GlobalProvider>
        </WallpaperStoreProvider>
      </ThemePresetStoreProvider>
    </DsbStoreProvider>
  )
}
