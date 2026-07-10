/*
 *
 * GlobalLayout
 *
 */

import { usePathname } from 'next/navigation'
import type { FC, ReactNode } from 'react'

import usePageBg from '~/hooks/usePageBg'
import useTopbar from '~/hooks/useTopbar'
import useTrans from '~/hooks/useTrans'
import type { TContainerMetric } from '~/hooks/useTwBelt/spec'
// import Broadcast from '~/widgets/Broadcast'
import Footer from '~/unit/SiteFooter'
// import DashboardAlert from './D
// import CustomScroller from '~/widgets/CustomScroller'
import GlowBackground from '~/widgets/GlobalLayout/GlowBackground'
import useSalon from '~/widgets/GlobalLayout/salon/main'

type TProps = {
  children: ReactNode
}

const Main: FC<TProps> = ({ children }) => {
  const pathname = usePathname()
  const isDocArticleRoute = /^\/[^/]+\/doc\/[^/]+\/[^/]+(?:\/)?$/.test(pathname || '')
  const containerMetric: TContainerMetric | null = isDocArticleRoute ? 'community-doc' : null
  const s = useSalon({ containerMetric })

  /**
   * this is tricky, when client-side changed locale, we force render hte entire app here
   * the action will make sure each component who use useTrans will not need to wrap with observer
   */
  const { locale } = useTrans()

  const { hasTopbar } = useTopbar()
  const { background } = usePageBg()
  // const [showDashboardAlertUI, setShowDashboardAlertUI] = useState(false)
  // style={{ background }}

  return (
    <main key={locale} className={s.wrapper} style={{ backgroundColor: 'transparent' }}>
      {/* Keep page background on a child layer, not on <main> itself.
       * Theme preview sliders update --preview-page-bg at pointer-move speed.
       * Applying that directly to <main> repaints the full layout and combines
       * poorly with backdrop blur. This isolated layer keeps realtime preview
       * cheap while still letting transparent glass colors reveal the page base.
       */}
      {background && (
        <div
          className={s.background}
          style={{ backgroundColor: `var(--preview-page-bg, ${background})` }}
        />
      )}
      {hasTopbar && <div className={s.topBar} />}
      {/* <Broadcast /> */}
      <GlowBackground />
      <div className={s.body}>
        <div className={s.inner}>{children}</div>
      </div>
      <div className={s.footer}>
        <Footer containerMetric={containerMetric} />
      </div>
    </main>
  )
}

export default Main
