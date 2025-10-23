/*
 *
 * GlobalLayout
 *
 */

import { type FC, lazy, type ReactNode, Suspense } from 'react'

import Mushroom from '~/containers/Mushroom'
import useTheme from '~/hooks/useTheme'

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
}

const GlobalLayout: FC<TProps> = ({ children }) => {
  const s = useSalon()
  const { theme } = useTheme()

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
    <div className={theme}>
      <Mushroom />
      <Suspense fallback={null}>
        <Addon />
      </Suspense>
      <div className={s.skeleton}>
        <Wallpaper />
        <div className={s.scrollWrapper}>
          <div className={s.wrapper}>
            <SEO />
            <Main>{children}</Main>
            {/* {isMobile && <ModeLine />} */}
          </div>
        </div>
      </div>

      {/* <DashboardAlert /> */}
      {/* {showDashboardAlertUI && <DashboardAlert />} */}
    </div>
  )
}

export default GlobalLayout
