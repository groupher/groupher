/*
 *
 * general ArticleContent for Post, Job, Blog, Radar ..
 *
 */

import { Suspense, useRef } from 'react'

import useArticle from '~/hooks/useArticle'
import ArtimentBody from '~/widgets/ArtimentBody'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
// import ViewportTracker from '~/widgets/ViewportTracker'

import useSalon from '../salon/post/content'

// export const Comments = lazy(() => import('~/containers/unit/Comments'))

export default () => {
  const ref = useRef(null)
  const { article } = useArticle()

  if (!article) {
    return <h1>Error article</h1>
  }

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
            TODO: comments
            {/* <Comments /> */}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
