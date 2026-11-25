import { useSuspenseQuery } from '@tanstack/react-query'
import { type ReactNode, useEffect } from 'react'

import { GlobalProvider } from '~/app/providers'
import METRIC from '~/const/metric'
import { Q } from '~/query'
import DsbShellProvider from '~/stores/dsbShell/provider'
import { MetricProvider } from '~/stores/metric'
import CommunityDigest from '~/unit/CommunityDigest/DsbLayout'
import { SideMenu } from '~/unit/DsbThread'

import { clearAuthRouteRecoveryAttempt } from '../utils/auth-route-recovery'
import DsbProjectionProvider from './DsbProjectionProvider'
import WallpaperEditorBoundary from './WallpaperEditorBoundary'

type TProps = {
  children: ReactNode
  data: {
    community: string
    demoMode: boolean
  }
}

export default function DsbShell({ children, data }: TProps) {
  const { data: dashboard } = useSuspenseQuery(Q.dsb.slug(data.community))
  const { data: wallpaper } = useSuspenseQuery(Q.wallpaper.slug(data.community))
  useEffect(() => {
    clearAuthRouteRecoveryAttempt(window.location.href)
  }, [])

  const shellContent = (
    <WallpaperEditorBoundary
      community={data.community}
      dashboard={dashboard}
      demoMode={data.demoMode}
      wallpaper={wallpaper}
    >
      <GlobalProvider authLoginModal={false}>
        <div
          className='column-center min-h-full w-full justify-start'
          data-demo-mode={data.demoMode}
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
    </WallpaperEditorBoundary>
  )

  return (
    <MetricProvider value={METRIC.DASHBOARD}>
      <DsbShellProvider
        key={`${data.community}:${data.demoMode ? 'demo' : 'live'}`}
        community={data.community}
        demoMode={data.demoMode}
        initialData={dashboard}
      >
        <DsbProjectionProvider initialData={dashboard}>{shellContent}</DsbProjectionProvider>
      </DsbShellProvider>
    </MetricProvider>
  )
}
