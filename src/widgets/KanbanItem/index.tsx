/*
 *
 * KanbanItem
 *
 */

import type { FC } from 'react'

import type { TArticle } from '~/spec'
import useLayout from '~/hooks/useLayout'
import { KANBAN_LAYOUT } from '~/const/layout'

import WaterfallLayout from './WaterfallLayout'
import ClassicLayout from './ClassicLayout'

type TProps = {
  article: TArticle
}

const KanbanItem: FC<TProps> = ({ article }) => {
  const { kanbanLayout } = useLayout()

  return kanbanLayout === KANBAN_LAYOUT.WATERFALL ? (
    <WaterfallLayout article={article} />
  ) : (
    <ClassicLayout article={article} />
  )
}

export default KanbanItem
