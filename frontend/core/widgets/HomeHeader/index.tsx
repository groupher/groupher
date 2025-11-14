import { useMotionValueEvent, useScroll } from 'motion/react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { ROUTE } from '~/const/route'
import useSession from '~/hooks/useSession'
import DemoSVG from '~/icons/DemoTV'
import Button from '~/widgets/Buttons/Button'
import ThemeSwitch from '~/widgets/ThemeSwitch'

import IntroLinks from './IntroLinks'
import Panel from './Panel'
import useSalon, { cn } from './salon'

const HOVER_DELAY = 150

export default () => {
  const [activeMenu, setActiveMenu] = useState('')
  const timerRef = useRef<number | null>(null)
  const { scrollY } = useScroll()
  const [isSticky, setIsSticky] = useState(false)

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setIsSticky(latest > 400)
  })

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

  const s = useSalon({ extend: !!activeMenu, isSticky })

  useSession()

  return (
    <header className={s.wrapper}>
      <IntroLinks activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      <Panel active={activeMenu} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} />

      <div className={s.extraInfo}>
        <ThemeSwitch />
        <div className={s.divider} />
        {!isSticky ? (
          <Link className={s.requestDemoLink} href={`/${ROUTE.BOOK_DEMO}`}>
            <DemoSVG className={s.demoIcon} />
            <div>预约演示</div>
          </Link>
        ) : (
          <Link className={cn(s.requestDemoLink, 'scale-90')} href={`/${ROUTE.APPLY_COMMUNITY}`}>
            <Button space={3} className='bold-sm'>
              <span className='relative flex size-3 mr-2.5 brightness-125 scale-75'>
                <span className='absolute inline-flex w-full h-full rounded-full opacity-80 animate-ping bg-rainbow-purpleSoft'></span>
                <span className='relative inline-flex rounded-full size-3 bg-rainbow-purple'></span>
              </span>
              开始使用
            </Button>
          </Link>
        )}
      </div>
    </header>
  )
}
