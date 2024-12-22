import type { FC } from 'react'

import useViewingArticle from '~/hooks/useViewingArticle'
import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useNameAlias from '~/hooks/useNameAlias'
import { Trans } from '~/i18n'
import { ARTICLE_STATE } from '~/const/gtd'
import { aliasGTDDoneState } from '~/fmt'

import ArrowSVG from '~/icons/ArrowSimple'

import { ICON } from '../constant'

import useSalon, { cn } from '../styles/menu'
import { getGTDColor } from '../helper'

type TProps = {
  onClick: () => void
}

const StateItem: FC<TProps> = ({ onClick }) => {
  const { article } = useViewingArticle()
  const bgColors = useKanbanBgColors()
  const color = getGTDColor(article.state, bgColors)

  const s = useSalon({ color })

  const kanbanAlias = useNameAlias('kanban')

  const WipIcon = ICON[ARTICLE_STATE.WIP]

  if (article.state) {
    const TheIcon = ICON[article.state] || ICON[ARTICLE_STATE.REJECT]

    return (
      <div className={s.menuItem} onClick={onClick}>
        <TheIcon className={cn(s.icon, s.rainbowFill)} />
        {article.state === ARTICLE_STATE.DONE ? (
          <>{Trans(aliasGTDDoneState(article.cat, article.state))}</>
        ) : (
          <>
            {kanbanAlias[ARTICLE_STATE[article.state].toLowerCase()]?.name || Trans(article.state)}
          </>
        )}
        <div className="grow" />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </div>
    )
  }

  return (
    <div className={s.menuItem} onClick={onClick}>
      <WipIcon className={cn(s.icon, 'ml-px')} />
      状态
      <div className="grow" />
      <ArrowSVG className={cn(s.icon, 'rotate-180')} />
    </div>
  )
}

export default StateItem
