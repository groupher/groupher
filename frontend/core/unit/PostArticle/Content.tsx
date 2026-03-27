/*
 *
 * general ArticleContent for Post, Job, Blog, Radar ..
 *
 */

import { useRef } from 'react'

import useArticle from '~/stores/article/hooks'
import ArtimentBody from '~/widgets/ArtimentBody'
// import ViewportTracker from '~/widgets/ViewportTracker'

import Comments from '~/unit/Comments'
import useSalon from './salon/content'

export default function Content() {
  const ref = useRef(null)
  const { article } = useArticle()
  const s = useSalon()

  if (!article) {
    return <h1>Error article</h1>
  }

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div ref={ref} className={s.article}>
          {/* {!!article.linkAddr && <Linker src={article.linkAddr} bottom={22} />} */}
          <ArtimentBody document={article.document} />
        </div>
        <div className={s.comments}>
          <Comments />
        </div>
      </div>
    </div>
  )
}
