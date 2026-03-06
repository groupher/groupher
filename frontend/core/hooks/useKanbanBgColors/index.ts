import useDashboard from '~/hooks/useDashboard'
import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import type { TColorName } from '~/spec'

export default (): readonly TColorName[] => {
  const dsb$ = useDashboard()

  if (dsb$.kanbanBgColors.length === INIT_KANBAN_COLORS.length) {
    return dsb$.kanbanBgColors
  }

  return INIT_KANBAN_COLORS
}
