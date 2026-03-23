import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import useDashboard from '~/stores/dashboard/hooks'
import type { TColorName } from '~/spec'

export default function useKanbanBgColors(): readonly TColorName[] {
  const dsb$ = useDashboard()

  if (dsb$.kanbanBgColors.length === INIT_KANBAN_COLORS.length) {
    return dsb$.kanbanBgColors
  }

  return INIT_KANBAN_COLORS
}
