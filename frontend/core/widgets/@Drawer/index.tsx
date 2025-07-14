import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { ANCHOR } from '~/const/dom'
import TYPE from '~/const/type'
import { lockPage, unlockPage } from '~/dom'

import useDrawerOffset from '~/hooks/useDrawerOffset'
import useEvent from '~/hooks/useEvent'
import EVENT from '~/const/event'

import Portal from '~/widgets/Portal'

import useSalon, { cn } from './salon'

//
export default function Drawer({ children }) {
  const contentRef = useRef(null)
  const [visible, setVisible] = useState(false)

  const router = useRouter()
  const type = TYPE.DRAWER.POST_VIEW

  useEvent(EVENT.DRAWER.CONTENT_LOADED, () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0 })
    }
  })

  useEffect(() => {
    setVisible(true)
    lockPage()

    return () => {
      unlockPage()
    }
  }, [])

  const [drawerStyle, setDrawerStyle] = useState({})
  const { rightOffset, fromContentEdge } = useDrawerOffset()

  const s = useSalon({ visible, type, rightOffset, fromContentEdge })

  useEffect(() => {
    setDrawerStyle(s.drawerStyle)
  }, [s.drawerStyle])

  return (
    <Portal>
      <div className={s.drawer} style={drawerStyle}>
        <div ref={contentRef} className={s.drawerContent}>
          {children}
        </div>
      </div>
      <div
        className={cn(s.overlay, ANCHOR.GLOBAL_BLUR_CLASS)}
        style={s.overlayStyle}
        onClick={() => router.back()}
      />
    </Portal>
  )
}
