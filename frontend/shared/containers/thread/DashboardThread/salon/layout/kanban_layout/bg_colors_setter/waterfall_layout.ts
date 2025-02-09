import { isEmpty } from 'ramda'

import { INIT_KANBAN_COLORS } from '~/const/dashboard'
import useTwBelt from '~/hooks/useTwBelt'

import useKanban from '../../../../logic/useKanban'
import useBase from '../..'

export { cn } from '~/css'

export default () => {
  const { cn, shadow, rainbow, rainbowSoft } = useTwBelt()
  const base = useBase()

  const { kanbanBgColors } = useKanban()
  const [BG1, BG2, BG3] = isEmpty(kanbanBgColors) ? INIT_KANBAN_COLORS : kanbanBgColors

  return {
    wrapper: 'column w-full mt-7',
    header: cn(
      'column w-full h-7 rounded-md trans-all-200',
      'border border-dashed border-transparent ',
    ),
    bgTodo: rainbowSoft(BG1),
    bgTodoActive: cn(rainbow(BG1, 'border'), shadow('md')),
    bgWip: rainbowSoft(BG2),
    bgWipActive: rainbow(BG2, 'border'),
    bgDone: rainbowSoft(BG3),
    bgDoneActive: rainbow(BG3, 'border'),

    content: 'relative min-h-24',
    bar: cn(base.bar, 'h-1.5 opacity-30 saturate-0'),
  }
}
