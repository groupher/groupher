import { isEmpty } from 'ramda'

import { INIT_KANBAN_COLORS } from '~/const/dashboard'

import useTwBelt from '~/hooks/useTwBelt'

import useKanban from '../../../../logic/useKanban'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow, rainbowSoft, shadow } = useTwBelt()

  const { kanbanBgColors } = useKanban()

  const [BG1, BG2, BG3] = isEmpty(kanbanBgColors) ? INIT_KANBAN_COLORS : kanbanBgColors

  return {
    boardsWrapper: 'row-center gap-x-4 w-full mt-7',
    board: cn(
      'column w-56 h-72 p-2 gap-1.5 overflow-hidden rounded-md rounded-b-none',
      'border border-dashed border-transparent',
      'trans-all-200',
    ),

    boardTodo: rainbowSoft(BG1),
    todoActive: cn('-mt-2', rainbow(BG1, 'border'), shadow('lg')),
    boardWip: rainbowSoft(BG2),
    wipActive: cn('-mt-2', rainbow(BG2, 'border'), shadow('lg')),
    boardDone: rainbowSoft(BG3),
    doneActive: cn('-mt-2', rainbow(BG3, 'border'), shadow('lg')),
  }
}
