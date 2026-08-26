import { useContext } from 'react'

import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import type { TColorName } from '~/spec'
import { ShellStyleContext } from '~/stores/shellStyle/context'

/** Exposes kanban bg colors state and actions through the shared React hook boundary. */
export default function useKanbanBgColors(): readonly TColorName[] {
  const value = useContext(ShellStyleContext)
  if (!value) throw new Error('useKanbanBgColors must be used within ShellStyleProvider')

  if (value.kanbanBgColors.length === INIT_KANBAN_COLORS.length) {
    return value.kanbanBgColors
  }

  return INIT_KANBAN_COLORS
}
