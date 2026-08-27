import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import type { TColorName } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

/** Exposes kanban bg colors state and actions through the shared React hook boundary. */
export default function useKanbanBgColors(): readonly TColorName[] {
  const { kanbanBgColors } = useDsb()

  if (kanbanBgColors.length === INIT_KANBAN_COLORS.length) {
    return kanbanBgColors
  }

  return INIT_KANBAN_COLORS
}
