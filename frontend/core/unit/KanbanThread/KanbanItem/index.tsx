/*
 *
 * KanbanItem
 *
 */

import type { FC } from 'react'

import { KANBAN_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import type { TArticleState } from '~/spec'

import ClassicLayout from './ClassicLayout'
import WaterfallLayout from './WaterfallLayout'

type TProps = {
  viewModel: TArticleState
}

const KanbanItem: FC<TProps> = ({ viewModel }) => {
  const { kanbanLayout } = useLayout()

  return kanbanLayout === KANBAN_LAYOUT.WATERFALL ? (
    <WaterfallLayout viewModel={viewModel} />
  ) : (
    <ClassicLayout viewModel={viewModel} />
  )
}

export default KanbanItem
