/*
 *
 * GlobalLayout
 *
 */

import { type FC, lazy, type ReactNode, Suspense } from 'react'

import Mushroom from '~/containers/Mushroom'
import ThemeMonitor from './ThemeMonitor'

// import Broadcast from '~/widgets/Broadcast'
// import ModeLine from '~/containers/unit/ModeLine'

// import DashboardAlert from './DashboardAlert'
// import CustomScroller from '~/widgets/CustomScroller'

import Main from './Main'
import SEO from './SEO'
import useSalon from './salon'
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
  // const [showDashboardAlertUI, setShowDashboardAlertUI] = useState(false)
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
      <Mushroom />
      <Suspense fallback={null}>
        <Addon />
      </Suspense>
      <div className={s.skeleton}>
        <Wallpaper />
        <div className={s.scrollWrapper}>
          <MainWrapper>{children}</MainWrapper>
          {/* {isMobile && <ModeLine />} */}
        </div>
        <SEO />
      </div>

      <ThemeMonitor />

      {/* <DashboardAlert /> */}
      {/* {showDashboardAlertUI && <DashboardAlert />} */}
    </>
  )
}

export default GlobalLayout
