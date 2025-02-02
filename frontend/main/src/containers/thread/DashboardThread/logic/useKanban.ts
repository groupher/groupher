import { useCallback } from 'react'
import { pick } from 'ramda'

import type { TKanbanLayout, TKanbanCardLayout, TColorName, TEditFunc } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  kanbanLayout: TKanbanLayout
  kanbanCardLayout: TKanbanCardLayout

  getKanbanLayoutTouched: () => boolean
  getKanbanCardLayoutTouched: () => boolean
  getKanbanColorsTouched: () => boolean

  kanbanBgColors: TColorName[]
  saving: boolean
  edit: TEditFunc
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  // drived
  const getKanbanLayoutTouched = useCallback(() => isChanged('kanbanLayout'), [store])
  const getKanbanCardLayoutTouched = useCallback(() => isChanged('kanbanCardLayout'), [store])
  const getKanbanColorsTouched = useCallback(() => isChanged('kanbanBgColors'), [store])

  return {
    edit,
    ...pick(['kanbanLayout', 'kanbanCardLayout', 'kanbanBgColors', 'saving'], store),
    getKanbanLayoutTouched,
    getKanbanCardLayoutTouched,
    getKanbanColorsTouched,
  }
}
