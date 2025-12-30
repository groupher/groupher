import type { FC } from 'react'
import UpvoteSVG from '~/icons/Upvote'
import type { TActive, TArticleCat } from '~/spec'
import ArticleCatState from '~/widgets/ArticleCatState'

import useSalon, { cn } from '../../../salon/articles_intro_tabs/discuss_tab/discuss_demo/post_item'

type TProps = {
  title?: string
  opacity?: string
  count?: number
  cat?: TArticleCat
  className?: string
} & TActive

const PostItem: FC<TProps> = ({
  title = '',
  cat = 'FEATURE',
  count = 9,
  className = '',
  active,
}) => {
  const s = useSalon({ active })

  return (
    <div className={cn(s.wrapper, className)}>
      <div className={s.upvote}>
        <UpvoteSVG className={s.upvoteIcon} />
        <div className={s.count}>{count}</div>
      </div>

      <div className={s.rightPart}>
        <div className={s.title}>{title}</div>
        <div className={s.footer}>
          <ArticleCatState cat={cat} noBorder />
        </div>
      </div>
    </div>
  )
}

export default PostItem
