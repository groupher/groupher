/*
 *
 * GlobalLayout
 *
 */

import type { FC, ReactNode } from 'react'
import usePageBg from '~/hooks/usePageBg'
import useTopbar from '~/hooks/useTopbar'
import useTrans from '~/hooks/useTrans'

// import Broadcast from '~/widgets/Broadcast'
import Footer from '~/widgets/Footer'

// import DashboardAlert from './DashboardAlert'
// import CustomScroller from '~/widgets/CustomScroller'

import GlowBackground from './GlowBackground'

import useSalon from './salon/main'

type TProps = {
  children: ReactNode
}

const Main: FC<TProps> = ({ children }) => {
  const s = useSalon()

  const { hasTopbar } = useTopbar()
  const { background } = usePageBg()

  console.log('## background: ', background)
  /**
   * this is tricy, when clientside changed locale, we force render hte entire app here
   * the action will make sure each component who use useTrans will not need to wrap with observer
   */
  const { locale } = useTrans()

  // const [showDashboardAlertUI, setShowDashboardAlertUI] = useState(false)

  return (
    <div key={locale} className={s.wrapper} style={{ background }}>
      {hasTopbar && <div className={s.topBar} />}
      {/* <Broadcast /> */}
      <div className={s.body}>{children}</div>
      <Footer />
      <GlowBackground />
    </div>
  )
}

export default Main
