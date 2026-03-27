import { pick } from 'ramda'
import type { TColorName, TEditFunc, TKanbanCardLayout, TKanbanLayout } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from './useHelper'

type TRet = {
  kanbanLayout: TKanbanLayout
  kanbanCardLayout: TKanbanCardLayout

  isKanbanLayoutTouched: boolean
  isKanbanCardLayoutTouched: boolean
  isKanbanColorsTouched: boolean

  kanbanBgColors: readonly TColorName[]
  saving: boolean
  edit: TEditFunc
}

export default function useKanban(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const isKanbanLayoutTouched = isChanged('kanbanLayout')
  const isKanbanCardLayoutTouched = isChanged('kanbanCardLayout')
  const isKanbanColorsTouched = isChanged('kanbanBgColors')

  return {
    edit,
    ...pick(['kanbanLayout', 'kanbanCardLayout', 'kanbanBgColors', 'saving'], dsb$),
    isKanbanLayoutTouched,
    isKanbanCardLayoutTouched,
    isKanbanColorsTouched,
  }
}
