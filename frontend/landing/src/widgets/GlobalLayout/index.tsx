/*
 *
 * GlobalLayout
 *
 */

import type { FC, ReactNode } from 'react'

import SEO from './SEO'
import Wallpaper from './Wallpaper'
import Main from './Main'

import useSalon from './salon'

type TProps = {
  children: ReactNode
}

const GlobalLayout: FC<TProps> = ({ children }) => {
  const s = useSalon()

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
    </>
  )
}

export default GlobalLayout
