import { INIT_KANBAN_COLORS } from '~/const/dashboard'

import useTwBelt from '~/hooks/useTwBelt'

import useKanban from '../../../../logic/useKanban'

export { cn } from '~/css'

export default function useSalon(columnsCount = 5) {
  const { cn, rainbow, rainbowSoft, shadow } = useTwBelt()
  const isCompactBoards = columnsCount <= 3
  const isHintScrollableBoards = columnsCount === 4
  let boardWidth = 'w-52 min-w-52'

  if (isCompactBoards) {
    boardWidth = 'grow basis-0 min-w-0'
  } else if (isHintScrollableBoards) {
    boardWidth = 'shrink-0 w-1/4 min-w-44'
  }

  const { kanbanBgColors } = useKanban()

  const [BG1, BG2, BG3, BG4, BG5] =
    kanbanBgColors.length === INIT_KANBAN_COLORS.length ? kanbanBgColors : INIT_KANBAN_COLORS

  return {
    boardsWrapper: cn(
      'w-full mt-7 gap-x-4',
      isCompactBoards
        ? 'row-center overflow-x-hidden'
        : 'row items-start justify-start overflow-x-auto',
    ),
    board: cn(
      'column h-72 p-2 gap-1.5 overflow-hidden rounded-md rounded-b-none',
      'border border-dashed border-transparent',
      'trans-all-200',
      boardWidth,
    ),

    boardBacklog: rainbowSoft(BG1),
    backlogActive: cn('-mt-2', rainbow(BG1, 'border'), shadow('lg')),
    boardTodo: rainbowSoft(BG2),
    todoActive: cn('-mt-2', rainbow(BG2, 'border'), shadow('lg')),
    boardWip: rainbowSoft(BG3),
    wipActive: cn('-mt-2', rainbow(BG3, 'border'), shadow('lg')),
    boardDone: rainbowSoft(BG4),
    doneActive: cn('-mt-2', rainbow(BG4, 'border'), shadow('lg')),
    boardRejected: rainbowSoft(BG5),
    rejectedActive: cn('-mt-2', rainbow(BG5, 'border'), shadow('lg')),
  }
}
