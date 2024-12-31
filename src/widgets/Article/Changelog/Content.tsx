/*
 *
 * general ArticleContent for Changelog, Job, Blog, Radar ..
 *
 */

import { type FC, lazy, useRef, Suspense } from 'react'

import type { TChangelog } from '~/spec'

import ArtimentBody from '~/widgets/ArtimentBody'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
// import ViewportTracker from '~/widgets/ViewportTracker'

import { Wrapper, InnerWrapper, ArticleWrapper, CommentsWrapper } from '../styles/changelog/content'

const Comments = lazy(() => import('~/containers/unit/Comments'))

type TProps = {
  article: TChangelog
}

const Content: FC<TProps> = ({ article }) => {
  const ref = useRef()

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
