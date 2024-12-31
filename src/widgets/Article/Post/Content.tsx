/*
 *
 * general ArticleContent for Post, Job, Blog, Radar ..
 *
 */

import { type FC, useRef, lazy, Suspense } from 'react'

import useViewingArticle from '~/hooks/useViewingArticle'
import ArtimentBody from '~/widgets/ArtimentBody'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
// import ViewportTracker from '~/widgets/ViewportTracker'

import { Wrapper, InnerWrapper, ArticleWrapper, CommentsWrapper } from '../styles/post/content'

const Comments = lazy(() => import('~/containers/unit/Comments'))

const Content: FC = () => {
  const ref = useRef()
  const { article } = useViewingArticle()

  return (
    <Wrapper>
      <InnerWrapper>
        {/* <ViewportTracker
          onEnter={() => checkAnchor(ref?.current)}
          onLeave={() => checkAnchor(ref?.current)}
        /> */}
        <ArticleWrapper ref={ref}>
          {/* {!!article.linkAddr && <Linker src={article.linkAddr} bottom={22} />} */}
          <ArtimentBody document={article.document} />
        </ArticleWrapper>

        {/* <ViewportTracker
            onEnter={() => checkAnchor(ref?.current)}
            onLeave={() => checkAnchor(ref?.current)}
          /> */}
        <CommentsWrapper>
          <Suspense fallback={<LavaLampLoading />}>
            <Comments />
          </Suspense>
        </CommentsWrapper>
      </InnerWrapper>
    </Wrapper>
  )
}

export default Content
