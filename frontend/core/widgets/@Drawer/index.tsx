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
}

export default function Drawer({ children, type = TYPE.DRAWER.POST_VIEW, resetKey }: TProps) {
  const router = useRouter()

  const contentRef = useRef<HTMLDivElement | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const resetRafRef = useRef<number | null>(null)

  const clearPendingReset = useCallback(() => {
    if (resetRafRef.current) {
      window.cancelAnimationFrame(resetRafRef.current)
      resetRafRef.current = null
    }
  }, [])

  const resetContentScroll = useCallback(() => {
    const container = contentRef.current
    if (!container) return false

    const anchor = container.querySelector<HTMLElement>('[data-drawer-scroll-anchor]')
    if (anchor) {
      const containerRect = container.getBoundingClientRect()
      const anchorRect = anchor.getBoundingClientRect()
      const nextTop = container.scrollTop + (anchorRect.top - containerRect.top)
      container.scrollTop = Math.max(0, nextTop)
      return true
    }

    return false
  }, [])

  const scheduleResetContentScroll = useCallback(
    (attempt = 0) => {
      const container = contentRef.current
      if (!container) return

      if (resetContentScroll()) return

      // if (attempt >= 12) {
      //   container.scrollTop = 0
      //   return
      // }

      clearPendingReset()
      resetRafRef.current = window.requestAnimationFrame(() => {
        resetRafRef.current = null
        scheduleResetContentScroll(attempt + 1)
      })
    },
    [clearPendingReset, resetContentScroll],
  )

  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  const closeTimerRef = useRef<number | null>(null)
  const didCloseRef = useRef(false)

  const { rightOffset, fromContentEdge } = useDrawerOffset()
  const s = useSalon({ visible, closing, type, rightOffset, fromContentEdge })

  useEffect(() => {
    lockPage()
    return () => {
      clearPendingReset()
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      unlockPage()
    }
  }, [clearPendingReset])

  useLayoutEffect(() => {
    didCloseRef.current = false
    setClosing(false)
    setVisible(false)

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    drawerRef.current?.offsetHeight

    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (!visible) return
    scheduleResetContentScroll()
  }, [visible, scheduleResetContentScroll])

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
        onClick={requestClose}
      />
    </Portal>
  )
}
