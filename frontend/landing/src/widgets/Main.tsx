'use client'

import { useMotionValue, useScroll } from 'motion/react'
import { type FC, type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react'

import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import HomeHeader from '~/unit/HomeHeader'
import Footer from '~/unit/SiteFooter'

import { LANDING_COVER_EXIT_CLEARANCE, LANDING_COVER_RANGE_KEY } from '../landingCoverBootstrap'
import {
  getLandingOpeningWidth,
  LANDING_OPENING_END,
  LANDING_OPENING_SCROLL_KEY,
  LANDING_OPENING_WIDTH_VAR,
} from '../landingOpening'
import { CoverMotionContext } from '../stores/coverMotion/context'
import useSalon from './salon/main'

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
  const { scrollY } = useScroll()
  const coverProgress = useMotionValue(0)
  const coverElement = useRef<HTMLDivElement | null>(null)
  const coverReady = useRef(false)
  const refreshGeometry = useRef<() => void>(() => {})
  const registerCover = useCallback((element: HTMLDivElement | null) => {
    coverElement.current = element
    refreshGeometry.current()
  }, [])
  const activateCover = useCallback(() => {
    if (coverReady.current) return
    coverReady.current = true
    refreshGeometry.current()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.removeAttribute('data-landing-cover-booting')
      })
    })
  }, [])
  const motionContext = useMemo(
    () => ({ progress: coverProgress, registerCover, activateCover }),
    [coverProgress, registerCover, activateCover],
  )

  useEffect(() => {
    const root = document.documentElement
    const cssDrivesOpening =
      CSS.supports('animation-timeline', 'scroll(root block)') &&
      CSS.supports('animation-range', `0px ${LANDING_OPENING_END}px`)
    let scrollRange = Math.max(window.innerHeight, 1)

    const update = (scrollTop: number) => {
      const progress = Math.min(1, Math.max(0, scrollTop / scrollRange))
      if (coverReady.current) coverProgress.set(progress)
      if (!cssDrivesOpening) {
        root.style.setProperty(
          LANDING_OPENING_WIDTH_VAR,
          `${getLandingOpeningWidth(window.innerWidth, scrollTop)}px`,
        )
      }
    }

    const persistScroll = () => {
      try {
        window.sessionStorage.setItem(
          LANDING_OPENING_SCROLL_KEY + window.location.pathname,
          String(window.scrollY),
        )
        window.sessionStorage.setItem(
          LANDING_COVER_RANGE_KEY + window.location.pathname,
          String(scrollRange),
        )
      } catch (_error) {}
    }

    const updateSize = () => {
      const coverBottom = coverElement.current?.getBoundingClientRect().bottom
      const coverBottomInDocument =
        coverBottom === undefined ? window.innerHeight : coverBottom + window.scrollY
      scrollRange = Math.max(coverBottomInDocument - LANDING_COVER_EXIT_CLEARANCE, 1)
      update(window.scrollY)
    }

    refreshGeometry.current = updateSize
    updateSize()
    const unsubscribe = scrollY.on('change', update)
    window.addEventListener('resize', updateSize)
    window.addEventListener('pagehide', persistScroll)
    window.addEventListener('pageshow', updateSize)
    document.addEventListener('visibilitychange', persistScroll)
    let active = true
    void document.fonts?.ready.then(() => {
      if (active) updateSize()
    })

    return () => {
      active = false
      refreshGeometry.current = () => {}
      unsubscribe()
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('pagehide', persistScroll)
      window.removeEventListener('pageshow', updateSize)
      document.removeEventListener('visibilitychange', persistScroll)
      root.style.removeProperty(LANDING_OPENING_WIDTH_VAR)
    }
  }, [coverProgress, scrollY])

  return (
    <CoverMotionContext value={motionContext}>
      <div className='relative w-full overflow-x-clip'>
        <main key={locale} className={LANDING_WRAPPER_CLASS}>
          <HomeHeader />
          <div className={s.body}>{children}</div>
          <Footer />
        </main>
      </div>
    </CoverMotionContext>
  )
}

export default Main
