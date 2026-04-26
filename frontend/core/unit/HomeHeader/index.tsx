import { useMotionValueEvent, useScroll } from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { ROUTE } from '~/const/route'
import DemoSVG from '~/icons/DemoTV'
import Button from '~/widgets/Buttons/Button'
import ThemeSwitch from '~/widgets/ThemeSwitch'

import IntroLinks from './IntroLinks'
import Panel from './Panel'
import useSalon, { cn } from './salon'

const HOVER_DELAY = 150

export default function HomeHeader() {
  const [activeMenu, setActiveMenu] = useState('')
  const timerRef = useRef<number | null>(null)
  const isInsideRef = useRef(false)
  const headerRef = useRef<HTMLElement>(null)
  const { scrollY } = useScroll()
  const [isSticky, setIsSticky] = useState(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

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
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (!isInsideRef.current) setActiveMenu('')
    }, HOVER_DELAY)
  }

  const handleMouseEnter = () => {
    isInsideRef.current = true
    cancelClose()
  }

  const handleMouseLeave = () => {
    isInsideRef.current = false
    scheduleClose()
  }

  const s = useSalon({ extend: !!activeMenu, isSticky })

  return (
    <header ref={headerRef} className={s.header}>
      <div
        className={s.inner}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-hidden='true'
      >
        <IntroLinks
          activeMenu={activeMenu}
          setActiveMenu={setActiveMenu}
          onLinkHover={cancelClose}
        />

        <Panel
          active={activeMenu}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />

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
                <span className='relative mr-2.5 flex size-3 scale-75 brightness-125'>
                  <span className='s-full bg-rainbow-purpleSoft absolute inline-flex animate-ping rounded-full opacity-80'></span>
                  <span className='bg-rainbow-purple relative inline-flex size-3 rounded-full'></span>
                </span>
                开始使用
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
