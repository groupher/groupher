'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ANCHOR } from '~/const/dom'
import TYPE from '~/const/type'
import { lockPage, unlockPage } from '~/dom'
import useDrawerOffset from '~/hooks/useDrawerOffset'
import useSalon, { cn } from '~/widgets/Drawer/salon'
import { CLOSE_ANIMATION_BUFFER_MS, CLOSE_ANIMATION_MS } from '~/widgets/Drawer/salon/constant'
import Portal from '~/widgets/Portal'

type TProps = {
  children: ReactNode
  type?: string
  resetKey?: string | number
  dismissible?: boolean
}

export default function Drawer({
  children,
  type = TYPE.DRAWER.POST_VIEW,
  resetKey,
  dismissible = true,
}: TProps) {
  const router = useRouter()

  const contentRef = useRef<HTMLDivElement | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const resetPostPaintRafRef = useRef<number | null>(null)
  const resetPostPaintTimerRef = useRef<number | null>(null)

  const clearPostPaintReset = useCallback(() => {
    if (resetPostPaintRafRef.current) {
      window.cancelAnimationFrame(resetPostPaintRafRef.current)
      resetPostPaintRafRef.current = null
    }
    if (resetPostPaintTimerRef.current) {
      window.clearTimeout(resetPostPaintTimerRef.current)
      resetPostPaintTimerRef.current = null
    }
  }, [])

  const resetContentToTop = useCallback(() => {
    const container = contentRef.current
    if (!container) return
    container.scrollTop = 0
  }, [])

  const schedulePostPaintReset = useCallback(() => {
    clearPostPaintReset()

    resetPostPaintRafRef.current = window.requestAnimationFrame(() => {
      resetPostPaintRafRef.current = null
      resetContentToTop()
    })

    resetPostPaintTimerRef.current = window.setTimeout(() => {
      resetPostPaintTimerRef.current = null
      resetContentToTop()
    }, 80)
  }, [clearPostPaintReset, resetContentToTop])

  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  const closeTimerRef = useRef<number | null>(null)
  const didCloseRef = useRef(false)

  const { rightOffset, fromContentEdge } = useDrawerOffset()
  const s = useSalon({ visible, closing, type, rightOffset, fromContentEdge })

  useEffect(() => {
    lockPage()
    return () => {
      clearPostPaintReset()
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      unlockPage()
    }
  }, [clearPostPaintReset])

  useLayoutEffect(() => {
    didCloseRef.current = false
    setClosing(false)
    setVisible(false)
    resetContentToTop()

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    drawerRef.current?.offsetHeight

    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [resetContentToTop])

  useLayoutEffect(() => {
    resetContentToTop()
  }, [resetKey, resetContentToTop])

  useEffect(() => {
    if (!visible) return

    schedulePostPaintReset()

    return clearPostPaintReset
  }, [visible, resetKey, clearPostPaintReset, schedulePostPaintReset])

  useEffect(() => {
    if (!visible) return

    const container = contentRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    let settleTimer: number | null = null
    let lastHeight = container.scrollHeight
    let stopped = false

    const stopObserver = () => {
      if (stopped) return
      stopped = true
      observer.disconnect()
      if (settleTimer) {
        window.clearTimeout(settleTimer)
        settleTimer = null
      }
    }

    const scheduleSettle = () => {
      if (settleTimer) window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        settleTimer = null
        resetContentToTop()
        stopObserver()
      }, 140)
    }

    const observer = new ResizeObserver(() => {
      const nextHeight = container.scrollHeight
      if (nextHeight === lastHeight) return

      lastHeight = nextHeight
      resetContentToTop()
      scheduleSettle()
    })

    observer.observe(container)
    scheduleSettle()

    return stopObserver
  }, [visible, resetKey, resetContentToTop])

  const commitRouteBack = useCallback(() => {
    if (didCloseRef.current) return
    didCloseRef.current = true
    router.back()
  }, [router])

  const requestClose = useCallback(() => {
    if (closing) return

    setClosing(true)
    setVisible(false)

    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      commitRouteBack()
    }, CLOSE_ANIMATION_MS + CLOSE_ANIMATION_BUFFER_MS)
  }, [closing, commitRouteBack])

  const handleDrawerTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== drawerRef.current) return

      if (closing && !visible && e.propertyName === 'opacity') {
        if (closeTimerRef.current) {
          window.clearTimeout(closeTimerRef.current)
          closeTimerRef.current = null
        }
        commitRouteBack()
        return
      }
    },
    [closing, visible, commitRouteBack],
  )

  return (
    <Portal>
      <div
        ref={drawerRef}
        className={s.drawer}
        style={s.drawerStyle}
        onTransitionEnd={handleDrawerTransitionEnd}
      >
        <div
          ref={contentRef}
          data-drawer-scroll-container='true'
          className={s.drawerContent}
          style={{ ...s.drawerContentStyle, overflowAnchor: 'none' }}
        >
          {children}
        </div>
      </div>

      <div
        role='presentation'
        aria-hidden='true'
        aria-label='drawer mask'
        className={cn(s.overlay, ANCHOR.GLOBAL_BLUR_CLASS)}
        style={s.overlayStyle}
        onClick={dismissible ? requestClose : undefined}
      />
    </Portal>
  )
}
