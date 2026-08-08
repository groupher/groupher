/*
 *
 * GlobalLayout
 *
 */

import type { FC, ReactNode } from 'react'

import useTopbar from '~/hooks/useTopbar'
import useTrans from '~/hooks/useTrans'
import type { TContainerMetric } from '~/hooks/useTwBelt/spec'
import { usePathname } from '~/platform'
// import DashboardAlert from './D
// import CustomScroller from '~/ui/CustomScroller'
import GlowBackground from '~/shell/GlobalLayout/GlowBackground'
import useSalon from '~/shell/GlobalLayout/salon/main'
// import Broadcast from '~/ui/Broadcast'
import Footer from '~/unit/SiteFooter'

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
      <div
        className={s.background}
        style={{
          backgroundColor: 'var(--preview-page-bg, var(--color-pageBg))',
        }}
      />
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
