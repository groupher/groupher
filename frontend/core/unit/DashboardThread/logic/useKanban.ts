import { equals, pick } from 'ramda'
import { INIT_KANBAN_BOARDS } from '~/const/dashboard'
import type { TColorName, TEditFunc, TKanbanBoard, TKanbanCardLayout, TKanbanLayout } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

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
  const { kanbanBoards, original } = dsb$

  const currentKanbanBoards =
    kanbanBoards.length > 0 ? kanbanBoards : INIT_KANBAN_BOARDS
  const originalKanbanBoards =
    original.kanbanBoards.length > 0 ? original.kanbanBoards : INIT_KANBAN_BOARDS

  const isKanbanLayoutTouched = isChanged('kanbanLayout')
  const isKanbanCardLayoutTouched = isChanged('kanbanCardLayout')
  const isKanbanBoardsTouched = !equals(currentKanbanBoards, originalKanbanBoards)
  const isKanbanColorsTouched = isChanged('kanbanBgColors')

  return {
    edit,
    ...pick(['kanbanLayout', 'kanbanCardLayout', 'kanbanBoards', 'kanbanBgColors', 'saving'], dsb$),
    isKanbanLayoutTouched,
    isKanbanCardLayoutTouched,
    isKanbanBoardsTouched,
    isKanbanColorsTouched,
  }
}
