import type { FC } from 'react'

import { ARTICLE_CAT } from '~/const/gtd'
import { cnMerge } from '~/css'
import UpvoteSVG from '~/icons/Upvote'
import type { TActive, TArticleCat } from '~/spec'
import ArticleCatStatus from '~/unit/ArticleCatStatus'

import useSalon from '../../../salon/articles_intro_tabs/discuss_tab/discuss_demo/post_item'

type TProps = {
  title?: string
  opacity?: string
  count?: number
  cat?: TArticleCat
  className?: string
} & TActive

const PostItem: FC<TProps> = ({
  title = '',
  cat = ARTICLE_CAT.IDEA,
  count = 9,
  className = '',
  active,
}) => {
  const s = useSalon({ active })

  return (
    <div className={cnMerge(s.wrapper, className)}>
      <div className={s.upvote}>
        <UpvoteSVG className={s.upvoteIcon} />
        <div className={s.count}>{count}</div>
      </div>

      <div className={s.rightPart}>
        <div className={s.title}>{title}</div>
        <div className={s.footer}>
          <ArticleCatStatus cat={cat} noBorder />
        </div>
      </div>
    </div>
  )
}

export default PostItem
