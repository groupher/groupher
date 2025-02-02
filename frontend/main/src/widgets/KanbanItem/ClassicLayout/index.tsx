/*
 *
 * KanbanItem
 *
 */

import type { FC } from 'react'

import type { TArticle } from '~/spec'
import useLayout from '~/hooks/useLayout'
import { KANBAN_CARD_LAYOUT } from '~/const/layout'

// import IconButton from '~/widgets/Buttons/IconButton'

import Full from './Full'
import Simple from './Simple'

type TProps = {
  article: TArticle
}

const KanbanItem: FC<TProps> = ({ article }) => {
  const { kanbanCardLayout } = useLayout()

  return kanbanCardLayout === KANBAN_CARD_LAYOUT.FULL ? (
    <Full article={article} />
  ) : (
    <Simple article={article} />
  )
}

export default KanbanItem
