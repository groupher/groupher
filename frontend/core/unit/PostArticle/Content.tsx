/*
 *
 * general ArticleContent for Post, Job, Blog, Radar ..
 *
 */

import { useRef } from 'react'

// import ViewportTracker from '~/ui/ViewportTracker'
import ArtimentBody from '~/render/ArtimentBody'
import useArticle from '~/stores/article/hooks'
import useCommunity from '~/stores/community/hooks'
import ReviewNotice from '~/unit/AlertWall/ReviewNotice'
import Comments from '~/unit/Comments'

import useSalon from './salon/content'

export default function Content() {
  const ref = useRef(null)
  const { article } = useArticle()
  const { slug: community } = useCommunity()
  const s = useSalon()

  if (!article) {
    return <h1>Error article</h1>
  }

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        {article.thread && article.thread !== 'DOC' && article.innerId && (
          <ReviewNotice
            target={{
              type: 'ARTICLE',
              article: { community, thread: article.thread, innerId: article.innerId },
            }}
          />
        )}
        <div ref={ref} className={s.article}>
          {/* {!!article.linkAddr && <Linker src={article.linkAddr} bottom={22} />} */}
          <ArtimentBody document={article.body ?? {}} />
        </div>
        <div className={s.comments}>
          <Comments />
        </div>
      </div>
    </div>
  )
}
