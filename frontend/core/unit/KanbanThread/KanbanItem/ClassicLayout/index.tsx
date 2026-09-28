/*
 *
 * KanbanItem
 *
 */

import type { FC } from 'react'

import { KANBAN_CARD_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import type { TArticleState } from '~/spec'
// import IconButton from '~/ui/Buttons/IconButton'

import Full from './Full'
import Simple from './Simple'

type TProps = {
  viewModel: TArticleState
}

const KanbanItem: FC<TProps> = ({ viewModel }) => {
  const { kanbanCardLayout } = useLayout()

  return kanbanCardLayout === KANBAN_CARD_LAYOUT.FULL ? (
    <Full viewModel={viewModel} />
  ) : (
    <Simple viewModel={viewModel} />
  )
}

export default KanbanItem
