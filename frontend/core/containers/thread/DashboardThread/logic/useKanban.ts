import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TColorName, TEditFunc, TKanbanCardLayout, TKanbanLayout } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  kanbanLayout: TKanbanLayout
  kanbanCardLayout: TKanbanCardLayout

  isKanbanLayoutTouched: boolean
  isKanbanCardLayoutTouched: boolean
  isKanbanColorsTouched: boolean

  kanbanBgColors: TColorName[]
  saving: boolean
  edit: TEditFunc
}

export default (): TRet => {
  const store = useDashboard()
  const { isChanged, edit } = useHelper()

  const isKanbanLayoutTouched = isChanged('kanbanLayout')
  const isKanbanCardLayoutTouched = isChanged('kanbanCardLayout')
  const isKanbanColorsTouched = isChanged('kanbanBgColors')

  // @ts-expect-error
  return {
    edit,
    ...pick(['kanbanLayout', 'kanbanCardLayout', 'kanbanBgColors', 'saving'], store),
    isKanbanLayoutTouched,
    isKanbanCardLayoutTouched,
    isKanbanColorsTouched,
  }
}
