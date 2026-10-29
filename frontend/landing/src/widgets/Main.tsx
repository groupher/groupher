'use client'

import { type FC, type ReactNode, useEffect } from 'react'

import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import HomeHeader from '~/unit/HomeHeader'

import {
  getLandingOpeningWidth,
  LANDING_OPENING_END,
  LANDING_OPENING_SCROLL_KEY,
  LANDING_OPENING_WIDTH_VAR,
} from '../landingOpening'
import useSalon from './salon/main'
import StaticFooter from './StaticFooter'

const LANDING_WRAPPER_CLASS = cn(
  'container-landing-wrapper column relative isolate s-full min-h-fit',
  'bg-pageBg',
)

type TProps = {
  children: ReactNode
}

const Main: FC<TProps> = ({ children }) => {
  const s = useSalon()
  const { locale } = useTrans()

  useEffect(() => {
    const root = document.documentElement
    const cssDrivesOpening =
      CSS.supports('animation-timeline', 'scroll(root block)') &&
      CSS.supports('animation-range', `0px ${LANDING_OPENING_END}px`)
    const updateWidth = () => {
      root.style.setProperty(
        LANDING_OPENING_WIDTH_VAR,
        `${getLandingOpeningWidth(window.innerWidth, window.scrollY)}px`,
      )
    }

    const persistScroll = () => {
      try {
        window.sessionStorage.setItem(
          LANDING_OPENING_SCROLL_KEY + window.location.pathname,
          String(window.scrollY),
        )
      } catch (_error) {}
    }

    if (!cssDrivesOpening) {
      updateWidth()
      window.addEventListener('scroll', updateWidth, { passive: true })
      window.addEventListener('resize', updateWidth)
      window.addEventListener('pageshow', updateWidth)
    }
    window.addEventListener('pagehide', persistScroll)
    document.addEventListener('visibilitychange', persistScroll)

    return () => {
      if (!cssDrivesOpening) {
        window.removeEventListener('scroll', updateWidth)
        window.removeEventListener('resize', updateWidth)
        window.removeEventListener('pageshow', updateWidth)
      }
      window.removeEventListener('pagehide', persistScroll)
      document.removeEventListener('visibilitychange', persistScroll)
      root.style.removeProperty(LANDING_OPENING_WIDTH_VAR)
    }
  }, [])

  return (
    <div className='relative w-full overflow-x-clip'>
      <main key={locale} className={LANDING_WRAPPER_CLASS}>
        <HomeHeader />
        <div className={s.body}>{children}</div>
        <StaticFooter />
      </main>
    </div>
  )
}

export default Main
