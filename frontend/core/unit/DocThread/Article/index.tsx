import { useRef } from 'react'

import { THREAD } from '~/const/thread'
import useTrackArticleView from '~/hooks/useTrackArticleView'
import type { TDocPublicTree } from '~/spec'
import useArticle from '~/stores/article/hooks'

import FeedbackFooter from '../FeedbackFooter'
import Body from './Body'
import Header from './Header'
import useSalon from './salon'

type TProps = {
  tree: TDocPublicTree
  community?: string
  innerId?: number
}

export default function Article({ tree, community = '', innerId = 0 }: TProps) {
  const s = useSalon()
  const wrapperRef = useRef<HTMLElement | null>(null)
  const { doc } = useArticle()
  useTrackArticleView(wrapperRef, { community, innerId, thread: THREAD.DOC }, Boolean(doc))

  return (
    <article ref={wrapperRef} className={s.wrapper}>
      <Header tree={tree} />
      <Body />
      <FeedbackFooter top={16} offsetRight={0} />
    </article>
  )
}
