'use client'

import { useMotionValue, useScroll } from 'motion/react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react'

import { LANDING_COVER_EXIT_CLEARANCE, LANDING_COVER_RANGE_KEY } from '../../landingCoverBootstrap'
import { CoverMotionContext } from './context'

type TProps = {
  children: ReactNode
}

export default function CoverMotionProvider({ children }: TProps) {
  const { scrollY } = useScroll()
  const progress = useMotionValue(0)
  const coverElement = useRef<HTMLDivElement | null>(null)
  const coverReady = useRef(false)
  const refreshGeometry = useRef<() => void>(() => {})

  const clearBootstrap = useCallback(() => {
    const root = document.documentElement
    root.removeAttribute('data-landing-cover-booting')
    for (const key of Array.from(root.style)) {
      if (key.startsWith('--landing-cover-boot-')) root.style.removeProperty(key)
    }
  }, [])

  const registerCover = useCallback((element: HTMLDivElement | null) => {
    coverElement.current = element
    refreshGeometry.current()
  }, [])

  const activateCover = useCallback(() => {
    if (coverReady.current) return
    coverReady.current = true
    refreshGeometry.current()
    requestAnimationFrame(() => {
      requestAnimationFrame(clearBootstrap)
    })
  }, [clearBootstrap])

  const context = useMemo(
    () => ({ progress, registerCover, activateCover }),
    [progress, registerCover, activateCover],
  )

  useEffect(() => {
    let scrollRange = Math.max(window.innerHeight, 1)

    const update = (scrollTop: number) => {
      if (!coverReady.current) return
      progress.set(Math.min(1, Math.max(0, scrollTop / scrollRange)))
    }

    const persistRange = () => {
      try {
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
    window.addEventListener('pagehide', persistRange)
    window.addEventListener('pageshow', updateSize)
    document.addEventListener('visibilitychange', persistRange)
    let active = true
    void document.fonts?.ready.then(() => {
      if (active) updateSize()
    })

    return () => {
      active = false
      refreshGeometry.current = () => {}
      unsubscribe()
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('pagehide', persistRange)
      window.removeEventListener('pageshow', updateSize)
      document.removeEventListener('visibilitychange', persistRange)
    }
  }, [progress, scrollY])

  return <CoverMotionContext value={context}>{children}</CoverMotionContext>
}
