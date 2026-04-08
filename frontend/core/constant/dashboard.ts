import { COLOR } from '~/const/colors'
import { KANBAN_BOARD } from '~/const/thread'
import type { TKanbanBoard } from '~/spec'

export const ONE_LINK_GROUP = '__ONE_LINK_GROUP__'
export const MORE_GROUP = '__MORE_GROUP__'

export const INIT_KANBAN_COLORS = [COLOR.BLACK, COLOR.YELLOW, COLOR.PURPLE, COLOR.GREEN, COLOR.RED]
export const INIT_KANBAN_BOARDS = [KANBAN_BOARD.TODO, KANBAN_BOARD.WIP, KANBAN_BOARD.DONE]

export const normalizeKanbanBoards = (boards?: readonly string[] | null): readonly TKanbanBoard[] => {
  if (!boards?.length) return INIT_KANBAN_BOARDS

  return boards.map((board) => board.toLowerCase() as TKanbanBoard)
}

export const serializeKanbanBoards = (boards: readonly TKanbanBoard[]): string[] => {
  return boards.map((board) => board.toUpperCase())
}

export const DEFAULT_ENABLE = {
  post: true,
  kanban: true,
  changelog: true,
  //
  doc: true,
  docLastUpdate: true,
  docReaction: true,
  //
  about: true,
  aboutTechstack: true,
  aboutLocation: true,
  aboutLinks: true,
  aboutMediaReport: true,
}

export const TW_CARD = {
  SUMMARY: 'summary',
  SUMMARY_LARGE_IMAGE: 'summary_large_image',
}
