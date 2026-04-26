/*
 *
 * KanbanItem
 *
 */

import type { FC } from 'react'

import { KANBAN_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import type { TArticle } from '~/spec'

import ClassicLayout from './ClassicLayout'
import WaterfallLayout from './WaterfallLayout'

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
