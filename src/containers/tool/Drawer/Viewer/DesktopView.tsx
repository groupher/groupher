import { type FC, type ReactNode, useEffect, useState } from 'react'

import { ANCHOR } from '~/const/dom'
import useDrawerOffset from '~/hooks/useDrawerOffset'

import type { TSwipeOption } from '../spec'

import useLogic from '../useLogic'
import useSalon, { cn } from '../salon'

type TProps = {
  options: TSwipeOption
  visible: boolean
  type: string
  children: ReactNode
}

const DesktopView: FC<TProps> = ({ options, visible, type, children }) => {
  const [drawerStyle, setDrawerStyle] = useState({})
  const { rightOffset, fromContentEdge } = useDrawerOffset()
  const { closeDrawer } = useLogic()

  const s = useSalon({ visible, type, rightOffset, fromContentEdge })

  useEffect(() => {
    setDrawerStyle(s.drawerStyle)
  }, [s.drawerStyle])

  return (
    <>
      <div
        className={cn(s.overlay, ANCHOR.GLOBAL_BLUR_CLASS)}
        onClick={() => closeDrawer()}
        style={s.overlayStyle}
      />
      <div className={s.drawer} style={drawerStyle}>
        <div className={s.drawerContent} style={s.drawerContentStyle}>
          {children}
        </div>
      </div>
    </>
  )
}

export default DesktopView
