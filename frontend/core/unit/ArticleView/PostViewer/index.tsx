/*
 * ArticleViewer
 */

import { useEffect, useState } from 'react'

import { BROADCAST_ARTICLE_LAYOUT } from '~/const/layout'
import useBroadcast from '~/hooks/useBroadcast'
import ArticleBody from '~/widgets/ArtimentBody'
import GotoTop from '~/widgets/GotoTop'
import { ArticleContentLoading } from '~/widgets/Loading'
import ViewportTracker from '~/widgets/ViewportTracker'

import ArticleBroadcast from '../ArticleBroadcast'
import ArticleFooter from '../ArticleFooter'
import useSalon, { cn } from '../salon/post_viewer'
import useLogic from '../useLogic'
import ArticleInfo from './ArticleInfo'
import FixedHeader from './FixedHeader'
import Header from './Header'

type TProps = {
  isFullView?: boolean
}

const INIT_VIEW_STATE = {
  fixedHeaderVisible: false,
  footerVisible: false,
  trackerReady: false,
}

export default function PostViewer({ isFullView = true }: TProps) {
  const s = useSalon()

  const { loading, article } = useLogic()
  const broadcastConfig = useBroadcast()

  const [viewState, setViewState] = useState(INIT_VIEW_STATE)

  useEffect(() => {
    setViewState(INIT_VIEW_STATE)

    const raf = window.requestAnimationFrame(() =>
      setViewState((prev) => ({ ...prev, trackerReady: true })),
    )
    return () => window.cancelAnimationFrame(raf)
  }, [article.innerId])

  const { fixedHeaderVisible, footerVisible, trackerReady } = viewState

  const hideFixedHeader = () => setViewState((prev) => ({ ...prev, fixedHeaderVisible: false }))
  const showFixedHeader = () => setViewState((prev) => ({ ...prev, fixedHeaderVisible: true }))

  const hideFooter = () => setViewState((prev) => ({ ...prev, footerVisible: false }))
  const showFooter = () => setViewState((prev) => ({ ...prev, footerVisible: true }))

  return (
    <>
      {isFullView && (
        <FixedHeader article={article} visible={fixedHeaderVisible} footerVisible={footerVisible} />
      )}
      <Header article={article} />
      <div className={s.title}>
        <div className={s.titleText}>{article.title}</div>
        <div className={s.subTitle}>{article.innerId}</div>
      </div>
      <ArticleInfo article={article} />
      {isFullView && (
        <ViewportTracker
          onEnter={() => {
            if (!trackerReady) return
            hideFixedHeader()
          }}
          onLeave={() => {
            if (!trackerReady) return
            showFixedHeader()
          }}
        />
      )}
      {loading && <ArticleContentLoading num={1} top={15} bottom={30} left={-25} />}
      {!loading && (
        <div className={s.bodyWrapper}>
          <ArticleBody document={article.document} />
        </div>
      )}

      {isFullView && broadcastConfig.broadcastArticleEnable && (
        <ArticleBroadcast
          top={20}
          bottom={30}
          color={broadcastConfig.broadcastArticleBg}
          simple={broadcastConfig.broadcastArticleLayout === BROADCAST_ARTICLE_LAYOUT.SIMPLE}
        />
      )}
      {isFullView && <ArticleFooter />}
      {isFullView && (
        <ViewportTracker
          onEnter={() => {
            if (!trackerReady) return
            showFooter()
          }}
          onLeave={() => {
            if (!trackerReady) return
            hideFooter()
          }}
        />
      )}
      {isFullView && (
        <div className={cn(s.gotoTop, fixedHeaderVisible ? 'visible' : 'invisible')}>
          <GotoTop type='drawer' />
        </div>
      )}
    </>
  )
}
