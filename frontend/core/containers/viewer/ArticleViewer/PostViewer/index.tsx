/*
 * ArticleViewer
 */

import RichEditor from '@groupher/rich-editor'
import { useCallback, useEffect, useState } from 'react'
import { BROADCAST_ARTICLE_LAYOUT } from '~/const/layout'
import { scrollDrawerToTop } from '~/dom'

import useBroadcast from '~/hooks/useBroadcast'
import ArticleBroadcast from '~/widgets/ArticleBroadcast'
import ArticleFooter from '~/widgets/ArticleFooter'
import ArticleBody from '~/widgets/ArtimentBody'
import GotoTop from '~/widgets/GotoTop'
import { ArticleContentLoading } from '~/widgets/Loading'
import ViewportTracker from '~/widgets/ViewportTracker'
import useSalon, { cn } from '../salon/post_viewer'
import useLogic from '../useLogic'
import ArticleInfo from './ArticleInfo'
import FixedHeader from './FixedHeader'
import Header from './Header'

export default () => {
  const s = useSalon()

  const { loading, article } = useLogic()
  const broadcastConfig = useBroadcast()

  const [fixedHeaderVisible, setFixedHeaderVisible] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)

  useEffect(() => {
    scrollDrawerToTop()
  }, [])

  const hideFixedHeader = useCallback(() => setFixedHeaderVisible(false), [])
  const showFixedHeader = useCallback(() => setFixedHeaderVisible(true), [])

  const hideFooter = useCallback(() => setFooterVisible(false), [])
  const showFooter = useCallback(() => setFooterVisible(true), [])

  return (
    <>
      <FixedHeader article={article} visible={fixedHeaderVisible} footerVisible={footerVisible} />
      <Header article={article} />
      <RichEditor />
      <div className={s.title}>
        <div className={s.titleText}>{article.title}</div>
        <div className={s.subTitle}>{article.innerId}</div>
      </div>
      <ArticleInfo article={article} />
      <ViewportTracker onEnter={hideFixedHeader} onLeave={showFixedHeader} />
      {loading && <ArticleContentLoading num={1} top={15} bottom={30} left={-25} />}
      {!loading && (
        <div className={s.bodyWrapper}>
          <ArticleBody document={article.document} />
        </div>
      )}

      {broadcastConfig.broadcastArticleEnable && (
        <ArticleBroadcast
          top={20}
          bottom={30}
          color={broadcastConfig.broadcastArticleBg}
          simple={broadcastConfig.broadcastArticleLayout === BROADCAST_ARTICLE_LAYOUT.SIMPLE}
        />
      )}
      <ArticleFooter />
      <ViewportTracker onEnter={showFooter} onLeave={hideFooter} />
      <div className={cn(s.gotoTop, fixedHeaderVisible ? 'visible' : 'invisible')}>
        <GotoTop type='drawer' />
      </div>
    </>
  )
}
