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

import useSalon from '../salon/changelog/content'

const Comments = lazy(() => import('~/containers/unit/Comments'))

type TProps = {
  article: TChangelog
}

const Content: FC<TProps> = ({ article }) => {
  const s = useSalon()

  const ref = useRef()

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.article} ref={ref}>
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

export default Content
