'use client'

import { useMotionValue, useReducedMotion, useScroll } from 'motion/react'
import { type FC, type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react'

import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import HomeHeader from '~/unit/HomeHeader'
import Footer from '~/unit/SiteFooter'

import { CoverMotionContext } from '../stores/coverMotion/context'
import useSalon from './salon/main'

const LANDING_WIDTH_VAR = '--container-landing-width'
const DEFAULT_CONTAINER_WIDTH = 1420
const COVER_EXIT_CLEARANCE = 64
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
  const reduceMotion = useReducedMotion()
  const coverElement = useRef<HTMLDivElement | null>(null)
  const refreshGeometry = useRef<() => void>(() => {})
  const registerCover = useCallback((element: HTMLDivElement | null) => {
    coverElement.current = element
    refreshGeometry.current()
  }, [])
  const motionContext = useMemo(
    () => ({ progress: coverProgress, registerCover }),
    [coverProgress, registerCover],
  )

  useEffect(() => {
    const root = document.documentElement
    const getConfiguredContainerWidth = (): number => {
      const rootStyle = window.getComputedStyle(root)
      const varValue = rootStyle.getPropertyValue(`${LANDING_WIDTH_VAR}-init`).trim()

      const value = Number.parseFloat(varValue)
      if (!Number.isFinite(value)) return DEFAULT_CONTAINER_WIDTH
      if (varValue.endsWith('rem')) return value * Number.parseFloat(rootStyle.fontSize)
      return varValue.endsWith('px') ? value : DEFAULT_CONTAINER_WIDTH
    }

    let fromWidth = window.innerWidth
    let toWidth = Math.min(getConfiguredContainerWidth(), fromWidth)
    let scrollRange = Math.max(window.innerHeight, 1)
    let lastWidth = ''

    const update = (scrollTop: number) => {
      const progress = Math.min(1, Math.max(0, scrollTop / scrollRange))
      coverProgress.set(progress)

      let width = '100vw'
      if (reduceMotion) width = `${toWidth}px`
      else if (scrollTop > 0) width = `${fromWidth + progress * (toWidth - fromWidth)}px`
      if (width === lastWidth) return
      root.style.setProperty(LANDING_WIDTH_VAR, width)
      lastWidth = width
    }

    const updateSize = () => {
      fromWidth = window.innerWidth
      toWidth = Math.min(getConfiguredContainerWidth(), fromWidth)
      const coverBottom = coverElement.current?.getBoundingClientRect().bottom
      const coverBottomInDocument =
        coverBottom === undefined ? window.innerHeight : coverBottom + window.scrollY
      scrollRange = Math.max(coverBottomInDocument - COVER_EXIT_CLEARANCE, 1)
      update(window.scrollY)
    }

    refreshGeometry.current = updateSize
    updateSize()
    const unsubscribe = scrollY.on('change', update)
    window.addEventListener('resize', updateSize)
    let active = true
    void document.fonts?.ready.then(() => {
      if (active) updateSize()
    })

    return () => {
      active = false
      refreshGeometry.current = () => {}
      unsubscribe()
      window.removeEventListener('resize', updateSize)
      root.style.removeProperty(LANDING_WIDTH_VAR)
    }
  }, [coverProgress, reduceMotion, scrollY])

  return (
    <CoverMotionContext value={motionContext}>
      <main key={locale} className={LANDING_WRAPPER_CLASS}>
        <HomeHeader />
        <div className={s.body}>{children}</div>
        <Footer />
      </main>
    </CoverMotionContext>
  )
}

export default Main
