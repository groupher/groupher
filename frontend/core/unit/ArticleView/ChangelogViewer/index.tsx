/*
 * ArticleViewer
 */

import { useEffect, useState } from 'react'

import ArticleBody from '~/widgets/ArtimentBody'
import GotoTop from '~/widgets/GotoTop'
import { ArticleContentLoading } from '~/widgets/Loading'
import ViewportTracker from '~/widgets/ViewportTracker'

import ArticleFooter from '../ArticleFooter'
import useSalon, { cn } from '../salon/changelog_viewer'
import useLogic from '../useLogic'
import ArticleInfo from './ArticleInfo'
import FixedHeader from './FixedHeader'
import Header from './Header'

type TProps = {
  isFullView?: boolean
}

export default function ChangelogViewer({ isFullView = true }: TProps) {
  const s = useSalon()

  const { loading, article } = useLogic()

  const [fixedHeaderVisible, setFixedHeaderVisible] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)
  const [trackerReady, setTrackerReady] = useState(false)

  useEffect(() => {
    setTrackerReady(false)
    setFixedHeaderVisible(false)
    setFooterVisible(false)

    const raf = window.requestAnimationFrame(() => setTrackerReady(true))
    return () => window.cancelAnimationFrame(raf)
  }, [article.innerId])

  const hideFixedHeader = () => setFixedHeaderVisible(false)
  const showFixedHeader = () => setFixedHeaderVisible(true)

  const hideFooter = () => setFooterVisible(false)
  const showFooter = () => setFooterVisible(true)

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
