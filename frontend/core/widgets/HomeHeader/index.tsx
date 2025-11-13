import Link from 'next/link'
import { useRef, useState } from 'react'

import { ROUTE } from '~/const/route'
import useSession from '~/hooks/useSession'
import DemoSVG from '~/icons/DemoTV'
import ThemeSwitch from '~/widgets/ThemeSwitch'

import IntroLinks from './IntroLinks'
import Panel from './Panel'
import useSalon from './salon'

const HOVER_DELAY = 120

const HomeHeader = () => {
  const [activeMenu, setActiveMenu] = useState('')
  const timerRef = useRef<number | null>(null)

  const cancelClose = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  const scheduleClose = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setActiveMenu(''), HOVER_DELAY)
  }

  const s = useSalon()

  useSession()

  return (
    <header className={s.wrapper}>
      <IntroLinks activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      <Panel active={activeMenu} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} />

      <div className={s.extraInfo}>
        <ThemeSwitch />
        <div className={s.divider} />
        <Link className={s.requestDemoLink} href={`/${ROUTE.BOOK_DEMO}`}>
          <DemoSVG className={s.demoIcon} />
          <div>预约演示</div>
        </Link>
      </div>
    </header>
  )
}

export default HomeHeader
