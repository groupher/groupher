import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import type { TColorName } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

export default function useKanbanBgColors(): readonly TColorName[] {
  const dsb$ = useDashboard()

  if (dsb$.kanbanBgColors.length === INIT_KANBAN_COLORS.length) {
    return dsb$.kanbanBgColors
  }

  return INIT_KANBAN_COLORS
}
