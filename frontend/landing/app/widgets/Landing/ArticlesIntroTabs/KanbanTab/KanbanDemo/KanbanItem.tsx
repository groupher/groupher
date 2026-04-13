import type { FC } from 'react'
import { ARTICLE_CAT } from '~/const/gtd'
import useTrans from '~/hooks/useTrans'
import UpvoteSVG from '~/icons/Upvote'
import type { TArticleCat } from '~/spec'
import ArticleCatState from '~/unit/ArticleCatState'

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
  title = '',
  cat = ARTICLE_CAT.FEATURE,
  draging = false,
  dragTarget = false,
  className = '',
}) => {
  const s = useSalon()
  const { t } = useTrans()

  if (dragTarget) {
    return (
      <div className={s.target}>
        <div>{t('landing.articles.kanban.item.drag_target')}</div>
      </div>
    )
  }

  return (
    <div className={cn(s.wrapper, draging && s.draging, className)}>
      <div className={s.title}>{title || t('landing.articles.kanban.item.default_title')}</div>

      <div className={s.footer}>
        <UpvoteSVG className={s.upvoteIcon} />
        <div className={s.count}>{count}</div>
        <ArticleCatState cat={cat} noBorder />
      </div>
    </div>
  )
}

export default KanbanItem
