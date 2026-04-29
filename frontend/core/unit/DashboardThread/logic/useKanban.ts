import { pick } from 'ramda'

import type { TColorName, TEditFunc, TKanbanBoard, TKanbanCardLayout, TKanbanLayout } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  kanbanLayout: TKanbanLayout
  kanbanCardLayout: TKanbanCardLayout
  kanbanBoards: readonly TKanbanBoard[]

  isKanbanLayoutTouched: boolean
  isKanbanCardLayoutTouched: boolean
  isKanbanBoardsTouched: boolean
  isKanbanColorsTouched: boolean

  kanbanBgColors: readonly TColorName[]
  saving: boolean
  edit: TEditFunc
}

export default function useKanban(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const isKanbanLayoutTouched = isChanged(FIELD.KANBAN_LAYOUT)
  const isKanbanCardLayoutTouched = isChanged(FIELD.KANBAN_CARD_LAYOUT)
  const isKanbanBoardsTouched = isChanged(FIELD.KANBAN_BOARDS)
  const isKanbanColorsTouched = isChanged(FIELD.KANBAN_BG_COLORS)

  return {
    edit,
    ...pick(['kanbanLayout', 'kanbanCardLayout', 'kanbanBoards', 'kanbanBgColors', 'saving'], dsb$),
    isKanbanLayoutTouched,
    isKanbanCardLayoutTouched,
    isKanbanBoardsTouched,
    isKanbanColorsTouched,
  }
}
