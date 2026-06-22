import type { FC } from 'react'

import { ARTICLE_CAT } from '~/const/gtd'
import { cnMerge } from '~/css'
import useTrans from '~/hooks/useTrans'
import UpvoteSVG from '~/icons/Upvote'
import type { TArticleCat } from '~/spec'
import ArticleCatStatus from '~/unit/ArticleCatStatus'

import useSalon from '../../../salon/articles_intro_tabs/kanban_tab/kanban_demo/kanban_item'

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
  cat = ARTICLE_CAT.IDEA,
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
    <div className={cnMerge(s.wrapper, draging && s.draging, className)}>
      <div className={s.title}>{title || t('landing.articles.kanban.item.default_title')}</div>

      <div className={s.footer}>
        <UpvoteSVG className={s.upvoteIcon} />
        <div className={s.count}>{count}</div>
        <ArticleCatStatus cat={cat} noBorder />
      </div>
    </div>
  )
}

export default KanbanItem
