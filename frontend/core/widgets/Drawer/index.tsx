'use client'

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ANCHOR } from '~/const/dom'
import EVENT from '~/const/event'
import TYPE from '~/const/type'
import { lockPage, unlockPage } from '~/dom'
import useDrawerOffset from '~/hooks/useDrawerOffset'
import useEvent from '~/hooks/useEvent'
import Portal from '~/widgets/Portal'
import useSalon, { cn } from './salon'
import { CLOSE_ANIMATION_MS } from './salon/constant'

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

  const { rightOffset, fromContentEdge } = useDrawerOffset()
  const s = useSalon({ visible, closing, type, rightOffset, fromContentEdge })

  useEvent(EVENT.DRAWER.CONTENT_LOADED, () => {
    contentRef.current?.scrollTo({ top: 0 })
  })

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (show) {
      setClosing(false)
      setMounted(true)
      lockPage()
      return
    }

    // close: trigger closing animation, then unmount
    setClosing(true)
    setVisible(false)

    // fallback: transitionend 可能因为浏览器/合成层问题不触发，兜底卸载
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      setClosing(false)
      unlockPage()
    }, CLOSE_ANIMATION_MS + 60)
  }, [show])

  // enter animation
  useLayoutEffect(() => {
    if (!mounted) return

    setClosing(false)
    setVisible(false)

    // establish initial transform for entry transition
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    drawerRef.current?.offsetHeight

    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [mounted])

  const handleDrawerTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== drawerRef.current) return

      // 关闭阶段依赖 opacity 结束卸载（我们关闭不做“滑出”）
      if (!show && closing && e.propertyName === 'opacity') {
        if (closeTimerRef.current) {
          window.clearTimeout(closeTimerRef.current)
          closeTimerRef.current = null
        }
        setMounted(false)
        setClosing(false)
        unlockPage()
      }
    },
    [show, closing],
  )

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      unlockPage()
    }
  }, [])

  if (!mounted) return null

  return (
    <Portal>
      <div
        ref={drawerRef}
        className={s.drawer}
        style={s.drawerStyle}
        onTransitionEnd={handleDrawerTransitionEnd}
      >
        <div ref={contentRef} className={s.drawerContent} style={s.drawerContentStyle}>
          {children}
        </div>
      </div>

      <div
        role='presentation'
        aria-hidden='true'
        aria-label='drawer mask'
        className={cn(s.overlay, ANCHOR.GLOBAL_BLUR_CLASS)}
        style={s.overlayStyle}
        onClick={onClose}
      />
    </Portal>
  )
}
