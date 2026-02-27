'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { ANCHOR } from '~/const/dom'
import EVENT from '~/const/event'
import TYPE from '~/const/type'
import { lockPage, unlockPage } from '~/dom'
import useDrawerOffset from '~/hooks/useDrawerOffset'
import useEvent from '~/hooks/useEvent'
import Portal from '~/widgets/Portal'
import useSalon, { cn } from './salon'

type TProps = {
  children: ReactNode
  show: boolean
  onClose: () => void
  type?: string
}

export default function Drawer({ children, show, onClose, type = TYPE.DRAWER.POST_VIEW }: TProps) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const { rightOffset, fromContentEdge } = useDrawerOffset()
  const s = useSalon({ visible: show, closing: false, type, rightOffset, fromContentEdge })

  useEvent(EVENT.DRAWER.CONTENT_LOADED, () => {
    contentRef.current?.scrollTo({ top: 0 })
  })

  useEffect(() => {
    if (!show) {
      unlockPage()
      return
    }

    lockPage()
    return () => unlockPage()
  }, [show])

  if (!show) return null

  return (
    <Portal>
      <div className={s.drawer} style={s.drawerStyle}>
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
