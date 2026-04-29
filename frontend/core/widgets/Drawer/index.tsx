'use client'

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ANCHOR } from '~/const/dom'
import TYPE from '~/const/type'
import { lockPage, unlockPage } from '~/dom'
import useDrawerOffset from '~/hooks/useDrawerOffset'
import Portal from '~/widgets/Portal'

import useSalon, { cn } from './salon'
import { CLOSE_ANIMATION_BUFFER_MS, CLOSE_ANIMATION_MS } from './salon/constant'

type TProps = {
  children: ReactNode
  show: boolean
  onClose: () => void
  type?: string
}

export default function Drawer({ children, show, onClose, type = TYPE.DRAWER.POST_VIEW }: TProps) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  const closeTimerRef = useRef<number | null>(null)
  const didCloseRef = useRef(false)

  // close action needs to be stable for timers / transitionend
  const onCloseRef = useRef<() => void>(() => {})
  onCloseRef.current = onClose

  const { rightOffset, fromContentEdge } = useDrawerOffset()
  const s = useSalon({ visible, closing, type, rightOffset, fromContentEdge })

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const commitClose = useCallback(() => {
    if (didCloseRef.current) return
    didCloseRef.current = true
    setMounted(false)
    setClosing(false)
    unlockPage()
    onCloseRef.current?.()
  }, [])

  const scheduleFallbackClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      commitClose()
    }, CLOSE_ANIMATION_MS + CLOSE_ANIMATION_BUFFER_MS)
  }, [clearCloseTimer, commitClose])

  const triggerEnter = useCallback(() => {
    didCloseRef.current = false
    setClosing(false)
    setVisible(false)

    void drawerRef.current?.offsetHeight

    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // show -> mounted / close orchestration (handles reopen while closing)
  useEffect(() => {
    clearCloseTimer()

    if (show) {
      lockPage()

      if (!mounted) {
        setMounted(true)
        return
      }

      if (closing || !visible) {
        triggerEnter()
      } else {
        setClosing(false)
      }

      return
    }

    // show=false -> start closing animation (but keep mounted until animation ends)
    if (mounted) {
      setClosing(true)
      setVisible(false)
      scheduleFallbackClose()
    } else {
      unlockPage()
    }
  }, [show, mounted, visible, closing, clearCloseTimer, scheduleFallbackClose, triggerEnter])

  // initial mount enter: when mounted becomes true, run enter sequence once
  useLayoutEffect(() => {
    if (!mounted) return
    return triggerEnter()
  }, [mounted, triggerEnter])

  const handleDrawerTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== drawerRef.current) return
      if (closing && !visible && e.propertyName === 'opacity') {
        clearCloseTimer()
        commitClose()
      }
    },
    [closing, visible, clearCloseTimer, commitClose],
  )

  // unmount cleanup
  useEffect(() => {
    return () => {
      clearCloseTimer()
      unlockPage()
    }
  }, [clearCloseTimer])

  if (!mounted) return null

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
          style={s.drawerContentStyle}
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
        onClick={() => {
          // State drawer close is caller controlled
          onCloseRef.current?.()
        }}
      />
    </Portal>
  )
}
