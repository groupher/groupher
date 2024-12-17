import { type FC, type ReactNode, useState, useEffect } from 'react'
import { includes } from 'ramda'

import { ANCHOR } from '~/const/dom'
import useDrawerOffset from '~/hooks/useDrawerOffset'

import type { TSwipeOption } from '../spec'
import { ARTICLE_VIEWER_TYPES } from '../constant'

import ArticleNavi from './ArticleNavi'
import useLogic from '../useLogic'
import useSalon, { cn } from '../styles'

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

  // force style update
  useEffect(() => {
    setDrawerStyle(s.drawerStyle)
  }, [s.drawerStyle])

  const isArticleViewer = includes(type, ARTICLE_VIEWER_TYPES)

  return (
    <>
      <div
        className={cn(s.overlay, ANCHOR.GLOBAL_BLUR_CLASS)}
        onClick={() => closeDrawer()}
        style={s.overlayStyle}
      />
      <div className={s.drawer} style={drawerStyle}>
        <div className={s.drawerContent} style={s.drawerContentStyle}>
          {isArticleViewer && (
            <div className={s.naviArea}>
              <ArticleNavi />
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  )
}

export default DesktopView
