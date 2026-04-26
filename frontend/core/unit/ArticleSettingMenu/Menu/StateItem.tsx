import type { FC } from 'react'

import { ARTICLE_STATE } from '~/const/gtd'
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

const StateItem: FC<TProps> = ({ onClick }) => {
  const { article } = useViewingArticle()
  const bgColors = useKanbanBgColors()
  const kanbanAlias = useNameAlias('kanban')
  const { t } = useTrans()

  if (!article?.state) return <div>no state in this article</div>
  const color = getGTDColor(article.state, [...bgColors])
  const s = useSalon({ color })

  const WipIcon = ICON[ARTICLE_STATE.WIP]

  if (article.state) {
    const TheIcon = ICON[article.state] || ICON[ARTICLE_STATE.REJECT]

    return (
      <button type='button' className={s.menuItem} onClick={onClick}>
        <TheIcon className={cn(s.icon, s.rainbowFill)} />
        {article.state === ARTICLE_STATE.DONE
          ? t(aliasGTDDoneState(article.cat, article.state))
          : kanbanAlias[article.state]?.name || t(toGTDLabelKey(article.state))}
        <div className='grow' />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </button>
    )
  }

  return (
    <button type='button' className={s.menuItem} onClick={onClick}>
      <WipIcon className={cn(s.icon, 'ml-px')} />
      {t('article.state')}
      <div className='grow' />
      <ArrowSVG className={cn(s.icon, 'rotate-180')} />
    </button>
  )
}

export default StateItem
