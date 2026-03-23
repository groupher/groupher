import type { FC } from 'react'
import UpvoteSVG from '~/icons/Upvote'
import type { TArticleCat } from '~/spec'
import ArticleCatState from '~/unit/article-cat-state'

import useSalon, { cn } from '../../../salon/articles_intro_tabs/kanban_tab/kanban_demo/kanban_item'

type TProps = {
  count?: number
  title?: string
  cat?: TArticleCat
  draging?: boolean
  dragTarget?: boolean
  className?: string
}

const KanbanItem: FC<TProps> = ({
  count = 9,
  title = '支持暗黑模式',
  cat = 'FEATURE',
  draging = false,
  dragTarget = false,
  className = '',
}) => {
  const s = useSalon()

  if (dragTarget) {
    return (
      <div className={s.target}>
        <div>已解决</div>
      </div>
    )
  }

  return (
    <div className={cn(s.wrapper, draging && s.draging, className)}>
      <div className={s.title}>{title}</div>

      <div className={s.footer}>
        <UpvoteSVG className={s.upvoteIcon} />
        <div className={s.count}>{count}</div>
        <ArticleCatState cat={cat} noBorder />
      </div>
    </div>
  )
}

export default KanbanItem
