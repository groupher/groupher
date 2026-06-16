/*
 *
 * GlobalLayout
 *
 */

import { type FC, lazy, type ReactNode, Suspense } from 'react'

import Mushroom from '~/widgets/Mushroom'
import Toaster from '~/widgets/Toaster'

import DemoModeSnackbarGate from './DemoModeSnackbarGate'
// import Broadcast from '~/widgets/Broadcast'
import LocaleSync from './LocaleSync'
// import CustomScroller from '~/widgets/CustomScroller'
import Main from './Main'
import useSalon from './salon'
import ThemeMonitor from './ThemeMonitor'
import Wallpaper from './Wallpaper'

const Addon = lazy(() => import('./Addon'))

// let DashboardAlert = null

type TProps = {
  children: ReactNode
  mainBlock?: FC<{ children: ReactNode }>
}

const GlobalLayout: FC<TProps> = ({ children, mainBlock }) => {
  const s = useSalon()
  const MainWrapper = mainBlock || Main

  // useSyncAccount()
  // const isMobile = false

  // useEffect(() => {
  //   if (showDashboardAlert) {
  //     DashboardAlert = dynamic(() => import('./DashboardAlert'), { ssr: false })
  //     setShowDashboardAlertUI(true)
  //   } else {
  //     setShowDashboardAlertUI(false)
  //   }
  // }, [showDashboardAlert])

  return (
    <>
      <LocaleSync />
      <Mushroom />
      <Suspense fallback={null}>
        <Addon />
      </Suspense>
      <div className={s.skeleton}>
        <Wallpaper />
        <div className={s.scrollWrapper}>
          <MainWrapper>{children}</MainWrapper>
        </div>
      </div>

      <ThemeMonitor />

      <Toaster />
      <DemoModeSnackbarGate />
    </>
  )
}

export default GlobalLayout
