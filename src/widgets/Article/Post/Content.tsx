/*
 *
 * general ArticleContent for Post, Job, Blog, Radar ..
 *
 */

import { useRef, lazy, Suspense } from 'react'

import useViewingArticle from '~/hooks/useViewingArticle'
import ArtimentBody from '~/widgets/ArtimentBody'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
// import ViewportTracker from '~/widgets/ViewportTracker'

import useSalon from '../salon/post/content'

export const Comments = lazy(() => import('~/containers/unit/Comments'))

export default () => {
  const ref = useRef()
  const { article } = useViewingArticle()

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div ref={ref} className={s.article}>
          {/* {!!article.linkAddr && <Linker src={article.linkAddr} bottom={22} />} */}
          <ArtimentBody document={article.document} />
        </div>
        <div className={s.comments}>
          <Suspense fallback={<LavaLampLoading />}>
            <Comments />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
