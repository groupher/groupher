import type { FC } from 'react'
import { ARTICLE_STATE } from '~/const/gtd'
import { aliasGTDDoneState } from '~/fmt'
import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useNameAlias from '~/hooks/useNameAlias'
import useViewingArticle from '~/hooks/useViewingArticle'
import useTrans from '~/hooks/useTrans'

import ArrowSVG from '~/icons/ArrowSimple'

import { ICON } from '../constant'
import { getGTDColor } from '../helper'
import useSalon, { cn } from '../salon/menu'

type TProps = {
  onClick: () => void
}

const StateItem: FC<TProps> = ({ onClick }) => {
  const { article } = useViewingArticle()
  if (!article?.state) return <div>no state in this article</div>

  const bgColors = useKanbanBgColors()
  const color = getGTDColor(article.state, [...bgColors])

  const s = useSalon({ color })
  const { t } = useTrans()

  const kanbanAlias = useNameAlias('kanban')

  const WipIcon = ICON[ARTICLE_STATE.WIP]

  if (article.state) {
    const TheIcon = ICON[article.state] || ICON[ARTICLE_STATE.REJECT]

    return (
      <button className={s.menuItem} onClick={onClick}>
        <TheIcon className={cn(s.icon, s.rainbowFill)} />
        {article.state === ARTICLE_STATE.DONE
          ? t(aliasGTDDoneState(article.cat, article.state))
          : kanbanAlias[ARTICLE_STATE[article.state].toLowerCase()]?.name || t(article.state)}
        <div className='grow' />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </button>
    )
  }

  return (
    <button className={s.menuItem} onClick={onClick}>
      <WipIcon className={cn(s.icon, 'ml-px')} />
      {t('article.state')}
      <div className='grow' />
      <ArrowSVG className={cn(s.icon, 'rotate-180')} />
    </button>
  )
}

export default StateItem
