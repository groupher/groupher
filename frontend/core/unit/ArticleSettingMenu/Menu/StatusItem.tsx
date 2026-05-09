import type { FC } from 'react'

import { ARTICLE_STATUS } from '~/const/gtd'
import { aliasGTDDoneState, toGTDLabelKey } from '~/fmt'
import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useNameAlias from '~/hooks/useNameAlias'
import useTrans from '~/hooks/useTrans'
import useViewingArticle from '~/hooks/useViewingArticle'
import ArrowSVG from '~/icons/ArrowSimple'

import { ICON } from '../constant'
import { getGTDColor } from '../helper'
import useSalon, { cn } from '../salon/menu'

type TProps = {
  onClick: () => void
}

const StatusItem: FC<TProps> = ({ onClick }) => {
  const { article } = useViewingArticle()
  const bgColors = useKanbanBgColors()
  const kanbanAlias = useNameAlias('kanban')
  const { t } = useTrans()

  if (!article?.status) return <div>no status in this article</div>
  const color = getGTDColor(article.status, [...bgColors])
  const s = useSalon({ color })

  const WipIcon = ICON[ARTICLE_STATUS.WIP]

  if (article.status) {
    const TheIcon = ICON[article.status] || ICON[ARTICLE_STATUS.REJECT]

    return (
      <button type='button' className={s.menuItem} onClick={onClick}>
        <TheIcon className={cn(s.icon, s.rainbowFill)} />
        {article.status === ARTICLE_STATUS.DONE
          ? t(aliasGTDDoneState(article.cat, article.status))
          : kanbanAlias[article.status]?.name || t(toGTDLabelKey(article.status))}
        <div className='grow' />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </button>
    )
  }

  return (
    <button type='button' className={s.menuItem} onClick={onClick}>
      <WipIcon className={cn(s.icon, 'ml-px')} />
      {t('article.status')}
      <div className='grow' />
      <ArrowSVG className={cn(s.icon, 'rotate-180')} />
    </button>
  )
}

export default StatusItem
